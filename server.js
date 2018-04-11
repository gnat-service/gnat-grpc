/**
 * Created by leaf4monkey on 04/09/2018
 */
const config = require('./config');
const GG = require('./gnat-grpc');
const utils = require('./utils');

const {check} = utils;
const {strOpt: checkStrOpt} = check;

const methodsHandler = function (methods) {
    const coll = {};
    Object.keys(methods).forEach(name => {
        const fn = methods[name];
        coll[name] = async function (call, callback) {
            let ret;
            let err;
            const o = {fn, call};
            try {
                ret = await o.fn(call.request);
            } catch (e) {
                err = e;
            }
            callback(err, ret);
        }
    });

    return coll;
};

class Server extends GG {
    constructor (opts = {}) {
        super();
        if (!opts.credentials) {
            console.warn('`opts.credentials` is not set, an insecure one will be used.');
        }
        checkStrOpt(opts, 'bindPath');

        this.server = new config.grpc.Server();
        this._options = opts;
    }

    async registerService (opts, methods) {
        opts = Object.assign(
            {fileLocation: 'local'},
            opts
        );
        checkStrOpt(opts, 'fileLocation');
        checkStrOpt(opts, 'protoPath');
        checkStrOpt(opts, 'pkgName');
        checkStrOpt(opts, 'service');

        const svc = await this._loadProto(opts);
        const handledMethods = methodsHandler(methods);
        this.server.addService(svc.service, handledMethods);
    }

    start () {
        const opts = this._options;
        this.server.bind(opts.bindPath, opts.credentials || config.grpc.ServerCredentials.createInsecure());
        return this.server.start();
    }
}

Server._utils = utils;

module.exports = Server;
