/**
 * Created by leaf4monkey on 04/09/2018
 */

const config = require('../config');
const loader = require('../utils/loader');
const request = require('../utils/request');
const fs = require('fs');
const PATH = require('path');
const {expect} = require('chai');
const sinon = require('sinon');
const get = require('lodash.get');

const filename = PATH.resolve(__dirname, './file-server/files/helloworld.proto');
const nonProtoFile = PATH.resolve(__dirname, './file-server/files/example.txt');

config._config({
    grpc: require('grpc'),
    protobufjs: require('protobufjs'),
    root: PATH.join(__dirname, 'file-server/files'),
});
const assertProto = (obj, {pkgName, svc, types}) => {
    const pkg = get(obj, pkgName);
    expect(obj).to.have.deep.property(pkgName).which.be.an('Object');
    expect(pkg)
        .to.have.property(svc)
        .which.have.property('service')
        .that.be.an('Object');

    types.forEach(type =>
        expect(pkg)
            .to.have.property(type)
    );
};

describe('loader', () => {
    const protoStr = fs.readFileSync(filename).toString();
    const protoAssertOpts = {pkgName: 'gnat.helloworld', svc: 'Greeter', types: ['HelloRequest', 'HelloReply']};
    describe('.loadFromString()', () => {
        it('should load grpc object from a ".proto" file', async () => {
            assertProto(loader.loadFromString(protoStr), protoAssertOpts)
        });
    });

    describe('.loadFromRemote()', () => {
        let stub;
        beforeEach(() => {
            stub = sinon.stub(request, 'get').returns(Promise.resolve(protoStr));
        });
        afterEach(async () => {
            stub.restore();
        });
        it('should load grpc object from a remote ".proto" file', async () => {
            assertProto(await loader.loadFromRemote(), protoAssertOpts)
        });
    });

    describe('.loadByVer6', () => {
        it('should load grpc object', async () => {
            assertProto(await loader.loadByVer6(filename), protoAssertOpts)
        });
        it('should be rejected on loading error', async () => {
            let e;
            try {
                await loader.loadByVer6(nonProtoFile);
            } catch (err) {
                e = err;
            }
            expect(e).to.be.an.instanceOf(Error).with.property('message').which.match(/illegal token 'Hello'/);
        });
    });
});
