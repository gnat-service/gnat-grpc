/**
 * Created by leaf4monkey on 04/10/2018
 */
const config = require('./config');
const utils = require('./utils');

const {protobuf, check} = utils;
const {serviceConflict: checkServiceConflict} = check;

class GnatGrpc {
    constructor () {
        this.services = {};
        this.root = new protobuf.Root();
    }

    static _getServiceKey ({pkgName, service}) {
        return `${pkgName}.${service}`;
    }

    async _loadProto (opts) {
        this.pkg = opts.fileLocation === 'remote' ?
            await protobuf.loadFromRemote(opts.protoPath, this.root) :
            config.grpc.load(opts.protoPath);

        const svc = this.pkg[opts.pkgName][opts.service];
        const key = GnatGrpc._getServiceKey(opts);

        checkServiceConflict(this.services, key);

        this.services[key] = svc;
        return svc;
    }
}

module.exports = GnatGrpc;
