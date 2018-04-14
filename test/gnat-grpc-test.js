/**
 * Created by leaf4monkey on 04/10/2018
 */
const config = require('../config');
const Server = require('../server');
const Client = require('../client');
const PATH = require('path');
const {expect} = require('chai');
const {random} = require('faker');

config._config({
    grpc: require('grpc'),
    protobufjs: require('protobufjs'),
    root: PATH.join(__dirname, 'file-server/files'),
});
const {grpc} = config;

const PORT = '50054';
const protoPath = PATH.resolve(__dirname, './file-server/files/helloworld.proto');
const protoPath2 = PATH.resolve(__dirname, './file-server/files/helloworld2.proto');
const sayHello = ({name}) => `Hello ${name}`;
const throwAnErr = ({name}) => {
    const err = new Error(`name "${name}" is not correct.`);
    err.code = config.grpc.status.PERMISSION_DENIED;
    throw err;
};

describe('GnatGrpc', () => {
    describe('Server', () => {
        describe('#start()', () => {
            let server;

            beforeEach(async () => {
                server = new Server({
                    bindPath: `0.0.0.0:${PORT}`
                });
                await Promise.all([
                    server.registerService(
                        {
                            filename: 'helloworld.proto',
                        },
                        {sayHello}
                    ),
                    server.registerService(
                        {
                            fileLocation: 'local',
                            protoPath: protoPath2,
                            pkgName: 'helloworld2',
                            service: 'Greeter2'
                        },
                        {sayHello}
                    )
                ]);
                server.start();
            });

            afterEach(done => server.server.tryShutdown(done));

            it('should create a grpc server', done => {
                const hello_proto = config.grpc.load(protoPath).helloworld;
                const client = new hello_proto.Greeter(`localhost:${PORT}`, config.grpc.credentials.createInsecure());

                const name = random.word();
                client.sayHello({name}, function(err, response) {
                    expect(response.message).to.equal(`Hello ${name}`);
                    done();
                });
            });

            it('should support multi services', done => {
                const hello_proto = config.grpc.load(protoPath).helloworld;
                const client = new hello_proto.Greeter(`localhost:${PORT}`, config.grpc.credentials.createInsecure());

                const name = random.word();
                client.sayHello({name}, function(err, response) {
                    expect(response.message).to.equal(`Hello ${name}`);

                    const hello_proto2 = config.grpc.load(protoPath2).helloworld2;
                    const client2 = new hello_proto2.Greeter2(`localhost:${PORT}`, config.grpc.credentials.createInsecure());

                    const name2 = random.word();
                    client2.sayHello({name: name2}, function(err, response) {
                        expect(response.message).to.equal(`Hello ${name2}`);
                        done();
                    });
                });
            });
        });
    });

    describe('Client', () => {
        let server;
        let client;
        let service;

        before(async () => {
            const hello_proto = config.grpc.load(protoPath).helloworld;
            const hello_proto2 = config.grpc.load(protoPath2).helloworld2;
            server = new config.grpc.Server();
            server.bind(`0.0.0.0:${PORT}`, config.grpc.ServerCredentials.createInsecure());
            server.addService(
                hello_proto.Greeter.service,
                {
                    sayHello: (call, callback) =>
                        callback(null, sayHello(call.request)),
                    throwAnErr: (call, callback) => {
                        try {
                            throwAnErr(call.request);
                        } catch (e) {
                            callback(e);
                        }
                    }
                }
            );
            server.addService(
                hello_proto2.Greeter2.service,
                {
                    sayHello: (call, callback) =>
                        callback(null, sayHello(call.request))
                }
            );
            server.start();
        });

        before(async () => {
            client = new Client();
        });

        before(async () => {
            service = await client.checkout({
                bindPath: `localhost:${PORT}`,
                filename: 'helloworld.proto',
            });
        });

        after(done => server.tryShutdown(done));

        context('Client#getService()', () => {
            it('should retrieve a service by `opts`', async () => {
                expect(client.getService({pkgName: 'helloworld', service: 'Greeter'}))
                    .to.equal(service);
            });
            it('should retrieve a service by formatted key', async () => {
                expect(client.getService('helloworld.Greeter')).to.equal(service);
            });
        });

        it('should create a grpc client', async () => {
            const service2 = await client.checkout({
                fileLocation: 'local',
                bindPath: `localhost:${PORT}`,
                protoPath: protoPath2,
                pkgName: 'helloworld2',
                service: 'Greeter2'
            });

            const name = random.word();
            const ret = await service.sayHello({name});
            const name2 = random.word();
            const ret2 = await service2.sayHello({name: name2});

            expect(ret).to.have.property('message').which.equal(`Hello ${name}`);
            expect(ret2).to.have.property('message').which.equal(`Hello ${name2}`);
        });

        it('should catch the error threw by server', async () => {
            let ret;
            let err;
            const name = random.word();
            try {
                ret = await service.throwAnErr({name});
            } catch (e) {
                err = e;
            }

            expect(ret).to.be.an('Undefined');
            expect(err).to.have.property('code').which.equal(grpc.status.PERMISSION_DENIED);
            expect(err).to.have.property('details').which.equal(`name "${name}" is not correct.`);
        });
    });
});
