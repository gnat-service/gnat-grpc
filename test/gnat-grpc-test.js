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

let PORT = 50054;
const protoPath = PATH.resolve(__dirname, './file-server/files/helloworld.proto');
const protoPath2 = PATH.resolve(__dirname, './file-server/files/helloworld2.proto');
const sayHello = ({name}) => {
    return `Hello ${name}`;
};
const throwAnErr = ({name}) => {
    const err = new Error(`name "${name}" is not correct.`);
    err.code = config.grpc.status.PERMISSION_DENIED;
    throw err;
};

describe('GnatGrpc', () => {
    describe('Server', () => {
        const assertServer = ({protoPath, pkgName, service}) => {
            const hello_proto = config.grpc.load(protoPath)[pkgName];
            const client = new hello_proto[service](`localhost:${PORT}`, config.grpc.credentials.createInsecure());

            const name = random.word();
            return new Promise(resolve => {
                client.sayHello({name}, function(err, response) {
                    expect(response.message).to.equal(`Hello ${name}`);
                    resolve();
                    client.close();
                });
            });
        };

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

            it('should create a grpc server', () =>
                assertServer({protoPath, pkgName: 'helloworld', service: 'Greeter'})
            );

            it('should support multi services', () =>
                Promise.all([
                    assertServer({protoPath, pkgName: 'helloworld', service: 'Greeter'}),
                    assertServer({protoPath: protoPath2, pkgName: 'helloworld2', service: 'Greeter2'})
                ])
            );
        });

        context('.addServer()', () => {
            let server;

            beforeEach(async () => {
                server = await Server.addServer({
                    bindPath: `0.0.0.0:${PORT}`,
                    services: [
                        {filename: 'helloworld.proto'},
                        {filename: 'helloworld2.proto'},
                    ],
                    methods: {
                        'helloworld.Greeter': {sayHello},
                        'helloworld2.Greeter2': {sayHello},
                    }
                });
                server.start();
            });

            afterEach(done => server.server.tryShutdown(done));

            it('should add multi services', () =>
                Promise.all([
                    assertServer({protoPath, pkgName: 'helloworld', service: 'Greeter'}),
                    assertServer({protoPath: protoPath2, pkgName: 'helloworld2', service: 'Greeter2'})
                ])
            );
        });
    });

    describe('Client', () => {
        let server;
        let client;
        let service;

        beforeEach(async () => {
            const hello_proto = config.grpc.load(protoPath).helloworld;
            const hello_proto2 = config.grpc.load(protoPath2).helloworld2;
            server = new config.grpc.Server();
            server.bind(`0.0.0.0:${PORT}`, config.grpc.ServerCredentials.createInsecure());
            server.addService(
                hello_proto.Greeter.service,
                {
                    sayHello: (call, callback) => {
                        if (call.request.name === '1111') {
                            console.log();
                        }
                        callback(null, sayHello(call.request));
                    },
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

        beforeEach(async () => {
            client = new Client();
        });

        beforeEach(async () => {
            service = await client.checkout({
                bindPath: `localhost:${PORT}`,
                filename: 'helloworld.proto',
            });
        });

        afterEach(done => server.tryShutdown(done));
        afterEach(() => client.rawClients[`helloworld.Greeter`].close());

        context('#getService()', () => {
            it('should retrieve a service by `opts`', async () => {
                expect(client.getService({pkgName: 'helloworld', service: 'Greeter'}))
                    .to.equal(service);
            });
            it('should retrieve a service by formatted key', async () => {
                expect(client.getService('helloworld.Greeter')).to.equal(service);
            });
        });

        context('.checkoutServices()', () => {
            let client;
            beforeEach(async () => {
                client = await Client.checkoutServices({
                    bindPath: `localhost:${PORT}`,
                    services: [
                        {filename: 'helloworld.proto'},
                        {filename: 'helloworld2.proto'},
                    ]
                });
            });

            afterEach(() => client.close());

            it('should create services', () =>
                Promise.all([
                    'helloworld.Greeter',
                    'helloworld2.Greeter2'
                ].map(async key => {
                    const service = client.getService(key);
                    const name = random.word();
                    const ret = await service.sayHello({name});
                    expect(ret).to.have.property('message').which.equal(`Hello ${name}`);
                }))
            );
        });

        context('#constructor()', () => {
            let service2;
            beforeEach(async () => {
                service2 = await client.checkout({
                    fileLocation: 'local',
                    bindPath: `localhost:${PORT}`,
                    protoPath: protoPath2,
                    pkgName: 'helloworld2',
                    service: 'Greeter2'
                });
            });
            afterEach(() => client.rawClients[`helloworld2.Greeter2`].close());

            it('should create a grpc client', async () => {
                const name = random.word();
                const name2 = random.word();
                const ret = await service.sayHello({name});
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
                    console.log(e.stack);
                }

                expect(ret).to.be.an('Undefined');
                expect(err).to.have.property('code').which.equal(grpc.status.PERMISSION_DENIED);
                expect(err).to.have.property('details').which.equal(`name "${name}" is not correct.`);
            });
        });
    });
});
