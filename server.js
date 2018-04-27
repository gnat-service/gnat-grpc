/**
 * Created by leaf4monkey on 04/09/2018
 */
const config = require('./config');
const GG = require('./gnat-grpc');
const utils = require('./utils');

const {check} = utils;
const {strOpt: checkStrOpt} = check;

const methodsHandler = function (methods) {
    const {Metadata} = config.grpc;
    const coll = {};
    Object.keys(methods).forEach(name => {
        const fn = methods[name];
        coll[name] = async function (call, callback) {
            let ret;
            let err;
            const trailer = new Metadata();
            const setTrailer = obj =>
                Object.keys(obj).forEach(key => trailer.set(key, obj[key]));
            let flags;
            const setFlags = obj => flags = obj;
            let {request, metadata} = call;
            if (metadata instanceof Metadata) {
                metadata = metadata.getMap();
            }
            const o = {fn, call, setTrailer, setFlags, metadata, request, context: coll};
            try {
                ret = await o.fn(request, metadata, {setTrailer, setFlags}, call);
            } catch (e) {
                err = GG._escapedError(e);
            }
            callback(err, ret, trailer, flags);
        }
    });

    return coll;
};

const svcMappingSym = Symbol('serviceMapping');
const servicesSym = Symbol('services');

class Server extends GG {
    constructor (opts = {}) {
        super();
        if (!opts.credentials) {
            console.warn('`opts.credentials` is not set, an insecure one will be used.');
        }
        checkStrOpt(opts, 'bindPath');

        this.server = new config.grpc.Server();
        this._options = opts;
        this[svcMappingSym] = [];
        this[servicesSym] = {};
    }

    async _loadProto (opts) {
        const svcMapping = await super._loadProto(opts);
        return svcMapping.map(({pkg, name, Svc}) => {
            const key = GG._getServiceKey({pkgName: pkg, service: name});
            const obj = {service: Svc.service, key};
            this[svcMappingSym].push(obj);
            this[servicesSym][key] = Svc.service;
            return obj;
        });
    }

    addMethods (key, methods) {
        const handledMethods = methodsHandler(methods);
        this.server.addService(this[servicesSym][key], handledMethods);
        return this;
    }

    async registerService (opts, methods) {
        const mapping = await this._loadProto(opts);
        mapping.map(({key}) => this.addMethods(key, methods));
    }

    start (...args) {
        const opts = this._options;
        this.server.bind(opts.bindPath, opts.credentials || config.grpc.ServerCredentials.createInsecure());
        return this.server.start(...args);
    }

    async tryShutdown () {
        return new Promise((resolve, reject) =>
            this.server.tryShutdown((err, res) => {
                err ? reject(err) : resolve(res);
            })
        );
    }

    static async addServer (configs, methods = configs.methods) {
        const server = new Server(configs);
        const {services} = configs;
        for (let cfg of services) {
            await server._loadProto(cfg);
        }
        // await Promise.all(services.map(cfg => server._loadProto(cfg)));

        methods && Object.keys(methods).forEach(key => server.addMethods(key, methods[key]));

        return server;
    }
}

Server._utils = utils;

module.exports = Server;
