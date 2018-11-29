/**
 * Created by leaf4monkey on 04/10/2018
 */
const GG = require('../gnat-grpc');
const config = require('../config');
const Server = require('../server');
const Client = require('../client');
const PATH = require('path');
const get = require('lodash.get');
const {expect} = require('chai');
const {random} = require('faker');

const protoLoader = require('@grpc/proto-loader');

config._config({
    grpc: require('grpc'),
    // protobufjs: require('protobufjs'),
    protoLoader,
    root: PATH.join(__dirname, 'file-server/files'),
});
const {grpc} = config;

let PORT = 50054;
const protoPath = PATH.resolve(__dirname, './file-server/files/helloworld.proto');
const protoPath2 = PATH.resolve(__dirname, './file-server/files/helloworld2.proto');
const throwAnErr = ({name}) => {
    const err = new Error(`使用了错误的名字 "${name}"，写错了写错了写错了写错了写错了写错了写错了写错了`);
    err.code = 20000;
    throw err;
};

describe('GnatGrpc', () => {
    let executed;

    beforeEach(() => {
        executed = 0;
    });
    describe('Server', () => {
        let asserts = [];
        const sayHello = function ({name}) {
            asserts.forEach(cb => cb.call(this, ...Array.prototype.slice.call(arguments, 0)));
            return {message: `Hello ${name}`, testExField: '1111', position: 'ADMIN'};
        };
        const assertServer = ({protoPath, pkgName, service}) => {
            const pkg = protoLoader.loadSync(protoPath);
            const hello_proto = get(config.grpc.loadPackageDefinition(pkg), pkgName);
            const client = new hello_proto[service](`localhost:${PORT}`, config.grpc.credentials.createInsecure());

            const name = random.word();
            return new Promise(resolve => {
                client.sayHello({name}, function(err, response) {
                    expect(response).to.have.property('message').that.equal(`Hello ${name}`);
                    expect(response).to.not.have.property('testExField');
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
                            pkgName: 'gnat.helloworld2',
                            service: 'Greeter2'
                        },
                        {sayHello}
                    )
                ]);
                server.start();
            });

            afterEach(() => server.tryShutdown());

            it('should create a grpc server', () =>
                assertServer({protoPath, pkgName: 'gnat.helloworld', service: 'Greeter'})
            );

            it('should support multi services', () =>
                Promise.all([
                    assertServer({protoPath, pkgName: 'gnat.helloworld', service: 'Greeter'}),
                    assertServer({protoPath: protoPath2, pkgName: 'gnat.helloworld2', service: 'Greeter2'})
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
                        'gnat.helloworld.Greeter': {sayHello},
                        'gnat.helloworld2.Greeter2': {sayHello},
                    }
                });
                server.start();
            });

            afterEach(done => server.server.tryShutdown(done));

            it('should add multi services', () =>
                Promise.all([
                    assertServer({protoPath, pkgName: 'gnat.helloworld', service: 'Greeter'}),
                    assertServer({protoPath: protoPath2, pkgName: 'gnat.helloworld2', service: 'Greeter2'})
                ])
            );
        });

        context('.addServerSync()', () => {
            let server;

            beforeEach(() => {
                server = Server.addServerSync({
                    bindPath: `0.0.0.0:${PORT}`,
                    services: [
                        {filename: 'helloworld.proto'},
                        {filename: 'helloworld2.proto'},
                    ],
                    methods: {
                        'gnat.helloworld.Greeter': {sayHello},
                        'gnat.helloworld2.Greeter2': {sayHello},
                    }
                });
                server.start();
            });

            afterEach(done => server.server.tryShutdown(done));

            it('should add multi services', () =>
                Promise.all([
                    assertServer({protoPath, pkgName: 'gnat.helloworld', service: 'Greeter'}),
                    assertServer({protoPath: protoPath2, pkgName: 'gnat.helloworld2', service: 'Greeter2'})
                ])
            );
        });

        describe('Service', () => {
            let server;
            let client;

            beforeEach(async () => {
                server = await Server.addServer({
                    bindPath: `0.0.0.0:${PORT}`,
                    services: [
                        {filename: 'helloworld.proto'},
                        {filename: 'helloworld2.proto'},
                    ],
                    methods: {
                        'gnat.helloworld.Greeter': {sayHello},
                        'gnat.helloworld2.Greeter2': {sayHello},
                    }
                });
                server.start();
            });
            beforeEach(() => {
                const pkg = protoLoader.loadSync(protoPath);
                const hello_proto = get(config.grpc.loadPackageDefinition(pkg), 'gnat.helloworld');
                client = new hello_proto.Greeter(`localhost:${PORT}`, config.grpc.credentials.createInsecure());
            });

            afterEach(() => client.close());
            afterEach(done => server.server.tryShutdown(done));

            context('#<method>', () => {
                let p;
                let name;
                const assertFn = function (...args) {
                    p = (async () => {
                        expect(args).to.have.length(4);
                        const [request, metaMap, setters, call] = args;
                        expect(request).to.be.an('Object')
                            .which.deep.equal({gender: 'MALE', name, position: 'ADMIN'});
                        expect(metaMap).to.be.an('Object')
                            .which.have.property('key')
                            .that.equal('value');
                        expect(setters).to.have.property('setTrailer').which.be.an('Function');
                        expect(setters).to.have.property('setFlags').which.be.an('Function');
                        executed++;
                    })();
                };
                before(() => {
                    name = random.word();
                    asserts.push(assertFn);
                });
                after(() => {
                    asserts.splice(asserts.indexOf(assertFn), 1);
                });
                it('service method should receive a predefined arguments list', async () => {
                    const meta = new grpc.Metadata();
                    meta.set('key', 'value');
                    const response = await new Promise((resolve, reject) =>
                        client.sayHello({name}, meta, (err, response) => {
                            err ? reject(err) : resolve(response);
                        })
                    );

                    expect(response).to.have.property('message').that.equal(`Hello ${name}`);
                    expect(response).to.not.have.property('testExField');
                    await p;
                    expect(executed).to.equal(1);
                });
                it('call a unimplemented method should fail', done => {
                    client.throwAnErr({}, (err) => {
                        expect(err).to.have.property('code').which.equal(grpc.status.UNIMPLEMENTED);
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
        let asserts = [];
        const sayHello = function (...args) {
            asserts.forEach(cb => cb.call(this, ...args));
            const {name, position = 'DEVELOPER'} = args[0];
            return {message: `Hello ${name}`, position};
        };

        beforeEach(async () => {
            const pkg = protoLoader.loadSync(protoPath);
            const hello_proto = get(config.grpc.loadPackageDefinition(pkg), 'gnat.helloworld');

            const pkg2 = protoLoader.loadSync(protoPath2);
            const hello_proto2 = get(config.grpc.loadPackageDefinition(pkg2), 'gnat.helloworld2');
            server = new config.grpc.Server();
            server.bind(`0.0.0.0:${PORT}`, config.grpc.ServerCredentials.createInsecure());
            server.addService(
                hello_proto.Greeter.service,
                {
                    sayHello (call, callback, ...args) {
                        callback(null, sayHello.call(this, call.request, call));
                    },
                    throwAnErr: (call, callback) => {
                        try {
                            throwAnErr(call.request);
                        } catch (e) {
                            callback(Server._escapedError(e));
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
        afterEach(() => client.close());

        context('#getService()', () => {
            it('should retrieve a service by `opts`', async () => {
                expect(client.getService({pkgName: 'gnat.helloworld', service: 'Greeter'}))
                    .to.equal(service);
            });
            it('should retrieve a service by formatted key', async () => {
                expect(client.getService('gnat.helloworld.Greeter')).to.equal(service);
            });
        });

        context('#constructor()', () => {
            let service2;
            beforeEach(async () => {
                service2 = await client.checkout({
                    fileLocation: 'local',
                    bindPath: `localhost:${PORT}`,
                    protoPath: protoPath2,
                    pkgName: 'gnat.helloworld2',
                    service: 'Greeter2'
                });
            });
            afterEach(() => client.close());

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
                }

                expect(ret).to.be.an('Undefined');
                expect(err).to.have.property('code').which.equal(20000);
                expect(err).to.have.property('details').which.equal(`使用了错误的名字 "${name}"，写错了写错了写错了写错了写错了写错了写错了写错了`);
            });
        });

        context('.checkoutServices()', () => {
            let client;
            beforeEach(async () => {
                client = await Client.checkoutServices({
                    bindPath: `localhost:${PORT}`,
                    services: [
                        {
                            // Cover the parent level `bindPath`.
                            // bindPath: `localhost:${PORT}`,
                            filename: 'helloworld.proto'
                        },
                        {filename: 'helloworld2.proto'},
                    ]
                });
            });

            afterEach(() => client.close());

            it('should create services', () =>
                Promise.all([
                    'gnat.helloworld.Greeter',
                    'gnat.helloworld2.Greeter2'
                ].map(async key => {
                    const service = client.getService(key);
                    const name = random.word();
                    const ret = await service.sayHello({name});
                    expect(ret).to.have.property('message').which.equal(`Hello ${name}`);
                }))
            );
        });

        context('.checkoutServicesSync()', () => {
            let client;
            beforeEach(() => {
                client = Client.checkoutServicesSync({
                    bindPath: `localhost:${PORT}`,
                    services: [
                        {
                            // Cover the parent level `bindPath`.
                            // bindPath: `localhost:${PORT}`,
                            filename: 'helloworld.proto'
                        },
                        {filename: 'helloworld2.proto'},
                    ]
                });
            });

            afterEach(() => client.close());

            it('should create services', () =>
                Promise.all([
                    'gnat.helloworld.Greeter',
                    'gnat.helloworld2.Greeter2'
                ].map(async key => {
                    const service = client.getService(key);
                    const name = random.word();
                    const ret = await service.sayHello({name});
                    expect(ret).to.have.property('message').which.equal(`Hello ${name}`);
                }))
            );
        });

        describe('ClientService', () => {
            context('#<method>', () => {
                it('call service method', async () => {
                    const name = random.word();
                    const ret = await service.sayHello({name});

                    expect(ret).to.have.property('message').which.equal(`Hello ${name}`);
                });
                it('check method name', async () => {
                    expect(service.sayHello).to.have.property('name').which.equal('sayHello');
                });
                context('call service method with metadata', () => {
                    let p;
                    const assertFn = function (req, call) {
                        p = (async () => {
                            console.log(this);
                            expect(call).to.have.property('metadata')
                                .to.be.an.instanceOf(grpc.Metadata);
                            const map = call.metadata.getMap();
                            expect(map).to.have.property('camelkey').which.equal('camelValue');
                            expect(map).to.not.have.property('camelKey');
                            executed++;
                        })();
                    };
                    before(() => {
                        asserts.push(assertFn);
                    });

                    after(() => {
                        asserts.splice(asserts.indexOf(assertFn), 1);
                    });

                    it('should read metadata in server side', async () => {
                        const name = random.word();
                        await service.sayHello({name, gender: 'FEMALE'}, {camelKey: 'camelValue'});
                        await p;
                        expect(executed).to.equal(1);
                    });
                });
                context('call service method with deadline', () => {
                    it('should read metadata in server side', async () => {
                        const name = random.word();
                        let err;
                        try {
                            await service.sayHello({name}, {}, {deadline: 1});
                        } catch (e) {
                            err = e;
                        }
                        expect(err).to.have.property('code').which.equal(grpc.status.DEADLINE_EXCEEDED);
                        expect(err).to.have.property('details').which.equal('Deadline Exceeded');
                    });
                });
            });
        });
    });

    describe('events', () => {
        let triggeredEvents;
        let allTriggeredEvts;
        const name = random.word();
        let server;
        let client;
        const expected = [
            [
                'server-postRegisterService',
                'server-postServerReady',
                'client-postRegisterService',
                'client-postServicesReady',
                "client-request",
                "server-request",
                "server-response",
                "client-response",
                'client-close',
                'server-close'
            ],
            [
                'server-postRegisterService',
                'client-postRegisterService',
                'client-postServicesReady'
            ]
        ];
        beforeEach(() => {
            triggeredEvents = [[]];
            allTriggeredEvts = {client: [], server: []};
        });
        const getServices = () => [
            {filename: 'helloworld.proto'},
            {filename: 'helloworld2.proto'},
        ];
        const sayHello = function ({name}) {
            return {message: `Hello ${name}`, testExField: '1111'};
        };

        const pubAsserts = (type, evt, self, args, expectedArgLen) => {
            const el = `${type}-${evt}`;
            expect(args).to.have.length(expectedArgLen);
            evt !== 'close' && expect(self).to.be.an.instanceOf(GG);

            allTriggeredEvts[type].push(el);
            triggeredEvents.some(arr => {
                if (arr.includes(el)) {
                    return false;
                }
                arr.push(el);
                return true;
            }) || triggeredEvents.push([el]);
        };

        const getEvts = (type, evtArgLenMap = {}) => {
            const results = {};
            (
                type === 'server' ?
                    ['postRegisterService', 'postServerReady', 'close'] :
                    ['postRegisterService', 'postServicesReady', 'close']
            ).forEach(evt => [
                results[evt] = (self, ...args) =>
                    pubAsserts(type, evt, self, args, evtArgLenMap.hasOwnProperty(evt) ? evtArgLenMap[evt] : 1),
            ]);
            return results;
        };

        const assertMetadata = (metadata, expected) => {
            expect(metadata).to.be.an.instanceOf(grpc.Metadata);
            expect(metadata.getMap()).to.deep.equal(expected);
        };

        beforeEach(async () => {
            server = await Server.addServer({
                bindPath: `0.0.0.0:${PORT}`,
                services: getServices(),
                methods: {
                    'gnat.helloworld.Greeter': {sayHello},
                    'gnat.helloworld2.Greeter2': {sayHello},
                },
                events: Object.assign(
                    {
                        request (self, call, ...restArgs) {
                            expect(call).to.includes.all.keys('metadata', 'request', 'call');

                            const meta = call.metadata.getMap();
                            expect(meta).to.have.property('user-agent').and.to.be.a('string');
                            assertMetadata(call.metadata, {
                                'user-agent': meta['user-agent'],
                                service: 'gnat.helloworld.Greeter',
                                'x-gnat-grpc-service': 'gnat.helloworld.Greeter',
                            });
                            expect(call.request).to.have.property('name').and.equal(name);
                            pubAsserts('server', 'request', self, restArgs, 0);
                        },
                        response (self, res, ...restArgs) {
                            expect(res).to.have.property('message').and.equal(`Hello ${name}`);
                            pubAsserts ('server', 'response', self, restArgs, 2);
                        }
                    },
                    getEvts('server', {postRegisterService: 2, close: 0, postServerReady: 0})
                )
            });
            server.start();
        });
        beforeEach(async () => {
            client = await Client.checkoutServices({
                bindPath: `localhost:${PORT}`,
                services: getServices(),
                events: Object.assign(
                    {
                        request (self, ...args) {
                            pubAsserts ('client', 'request', self, args, 3);
                            const [params, metadata, callOpts] = args;
                            expect(params).to.deep.equal({name});
                            assertMetadata(metadata, {
                                service: 'gnat.helloworld.Greeter',
                                'x-gnat-grpc-service': 'gnat.helloworld.Greeter',
                            });
                            expect(callOpts).to.deep.equal({});
                        },
                        response (self, res, ...restArgs) {
                            expect(res).to.deep.equal({message: `Hello ${name}`, position: 'ADMIN'});
                            pubAsserts ('client', 'response', self, restArgs, 0);
                        }
                    },
                    getEvts('client', {postRegisterService: 2, close: 0})
                )
            });
        });

        beforeEach(async () => {
            const service = client.getService('gnat.helloworld.Greeter');
            await service.sayHello({name});
        });

        beforeEach(() => client.close());
        beforeEach(() => server.tryShutdown());
        it('should trigger events by order', async () => {
            expect(triggeredEvents).to.have.length(expected.length);
            expected.forEach((el, i) =>
                expect(triggeredEvents[i]).to.deep.equal(el)
            );
            expect(allTriggeredEvts.server).to.deep.equal([
                'server-postRegisterService',
                'server-postRegisterService',
                'server-postServerReady',
                "server-request",
                "server-response",
                'server-close'
            ]);
            expect(allTriggeredEvts.client).to.deep.equal([
                "client-postRegisterService",
                "client-postServicesReady",
                "client-postRegisterService",
                "client-postServicesReady",
                "client-request",
                "client-response",
                "client-close",
            ]);
        });
    });

    describe('communication', () => {
        let server;
        let client;
        const asserts = [];

        const sayHello = function (call) {
            asserts.forEach(cb => cb.call(this, ...Array.prototype.slice.call(arguments, 0)));
            const {name, position = 'REPORTER'} = call;
            return {message: `Hello ${name}`, testExField: '1111', position};
        };

        beforeEach(async () => {
            server = await Server.addServer({
                bindPath: `0.0.0.0:${PORT}`,
                services: [
                    {filename: 'helloworld.proto'},
                    {filename: 'helloworld2.proto'},
                ],
                methods: {
                    'gnat.helloworld.Greeter': {sayHello},
                    'gnat.helloworld2.Greeter2': {sayHello},
                }
            });
            server.start();
        });
        beforeEach(() => {
            client = Client.checkoutServicesSync({
                bindPath: `localhost:${PORT}`,
                services: [
                    {
                        // Cover the parent level `bindPath`.
                        // bindPath: `localhost:${PORT}`,
                        filename: 'helloworld.proto'
                    },
                    {filename: 'helloworld2.proto'},
                ]
            });
        });

        afterEach(() => client.close());
        afterEach(done => server.server.tryShutdown(done));

        it('should read metadata in server side', async () => {
            const name = random.word();
            const gender = 'FEMALE';
            asserts.push((args) => {
                expect(args).to.deep.equal({name, position: 'ADMIN', gender});
            });
            const service = client.getService('gnat.helloworld.Greeter');
            const result = await service.sayHello({name, gender});
            expect(result).to.deep.equal({message: `Hello ${name}`, position: 'ADMIN'});
        });
    });
});
