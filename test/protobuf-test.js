/**
 * Created by leaf4monkey on 04/09/2018
 */

const protobuf = require('../utils/protobuf');
const request = require('../utils/request');
const fs = require('fs');
const PATH = require('path');
const {expect} = require('chai');
const sinon = require('sinon');

const assertProto = (obj, {pkgName, svc, types}) => {
    expect(obj).to.have.property(pkgName).which.be.an('Object');
    const pkg = obj[pkgName];
    expect(pkg)
        .to.have.property(svc)
        .which.have.property('service')
        .that.be.an('Object');

    types.forEach(type =>
        expect(pkg)
            .to.have.property(type)
    );
};

describe('protobuf', () => {
    const protoStr = fs.readFileSync(PATH.resolve(__dirname, './file-server/files/helloworld.proto')).toString();
    const protoAssertOpts = {pkgName: 'helloworld', svc: 'Greeter', types: ['HelloRequest', 'HelloReply']};
    describe('.loadFromString()', () => {
        it('should load protobuf object from a ".proto" file', async () => {
            assertProto(protobuf.loadFromString(protoStr), protoAssertOpts)
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
        it('should load protobuf object from a remote ".proto" file', async () => {
            assertProto(await protobuf.loadFromRemote(), protoAssertOpts)
        });
    });
});
