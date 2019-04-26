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
const {random, lorem} = require('faker');
const {spy} = require('sinon');

const protoLoader = require('@grpc/proto-loader');

const ggConf = {
    grpc: require('grpc'),
    protoLoader,
    // protobufjs,
    root: PATH.join(__dirname, 'proto'),
};
// if (Math.random() > .5) {
//     ggConf.grpcClient = grpcClient;
// }

config._config(ggConf);
const {grpc} = config;

let methodSpy;
const PORT = 50054;
const throwAnErr = ({name}) => {
    const err = new Error(`使用了错误的名字 "${name}"，写错了写错了写错了写错了写错了写错了写错了写错了`);
    err.code = 20000;
    throw err;
};

describe('GnatGrpc.Client.RetryStrategy', () => {
    let callCount = 0;
    describe('communication', () => {
        let server;
        let client;
        let keepThrowing;
        let maxRetries;
        let name;
        const gender = 'FEMALE';
        const key = 'gnat.helloworld.Greeter';

        const throwFn = function (call) {
            callCount++;
            if (keepThrowing) {
              return throwAnErr(call);
            }
            return {message: `Hello ${call.name}`};
        };

        const getClient = shouldRetryWhen =>
            Client.checkoutServicesSync({
                bindPath: `localhost:${PORT}`,
                services: [{filename: 'helloworld.proto'}],
                retryStrategy: {
                    maxRetries,
                    intervalMs: 0,
                    shouldRetryWhen
                }
            });

        beforeEach(() => {
            maxRetries = 5;
            keepThrowing = true;
            name = random.word();
        });

        beforeEach(async () => {
            methodSpy = spy(throwFn);
            server = await Server.addServer({
                bindPath: `0.0.0.0:${PORT}`,
                services: [
                    {filename: 'helloworld.proto'},
                    {filename: 'helloworld2.proto'},
                ],
                methods: {
                    [key]: {throwAnErr: methodSpy},
                }
            });
            server.start();
        });

        afterEach(() => {
            maxRetries = 0;
            keepThrowing = false;
            callCount = 0;
        });
        afterEach('tests done, shutdown client channels', () => client.close());
        afterEach('tests done, shutdown server', done => server.server.tryShutdown(done));

        context('when error keep occurring', function () {
            let count = 0;
            let cbSpy;
            beforeEach(() => {
                cbSpy = spy((status, retries) => {
                    const flag = status.code !== grpc.status.OK;
                    count = retries;
                    return flag;
                });
                client = getClient(cbSpy);
            });
            it('should retry until `maxRetries` exceed', async () => {
                const service = client.getService(key);
                let err;
                try {
                    await service.throwAnErr({name, gender});
                } catch (e) {
                    err = e;
                }

                expect(methodSpy.callCount).to.equal(maxRetries + 1);
                expect(cbSpy.callCount).to.equal(maxRetries);
                // 最后一次 retries 的变化不会被赋值给 count
                expect(count).to.equal(maxRetries - 1);
                expect(err).to.have.property('code').that.equal(20000);
                expect(err).to.have.property('details')
                    .that.equal(`使用了错误的名字 "${name}"，写错了写错了写错了写错了写错了写错了写错了写错了`);
                expect(err).to.have.property('metadata').that.be.an.instanceOf(client.grpc.Metadata);
                expect(err.metadata.get('gnat-grpc-error-code')).to.deep.equal(['20000']);
            });
        });

        context('when server side method recovery', function () {
            let count = 0;
            let cbSpy;
            let recoveryAfterTimes;
            beforeEach(() => {
                recoveryAfterTimes = 2;
                cbSpy = spy((status, retries) => {
                    console.log(status);
                    const flag = status.code !== grpc.status.OK;
                    if (flag) {
                        count = retries;
                    }
                    if (retries === recoveryAfterTimes) {
                        keepThrowing = false;
                    }
                    return flag;
                });
                client = getClient(cbSpy);
            });
            afterEach(() => {
                recoveryAfterTimes = 0;
            });
            it('should retry until `maxRetries` exceed', async () => {
                const service = client.getService(key);
                let err;
                let res;
                try {
                    res = await service.throwAnErr({name, gender});
                } catch (e) {
                    err = e;
                }

                expect(methodSpy.callCount).to.equal(1 + recoveryAfterTimes + 1);
                expect(cbSpy.callCount).to.equal(1 + recoveryAfterTimes + 1);
                expect(count).to.equal(recoveryAfterTimes);
                expect(err).to.equal(undefined);
                expect(res).to.deep.equal({message: `Hello ${name}`, position: 'ADMIN'});
            });
        });
    });
});
