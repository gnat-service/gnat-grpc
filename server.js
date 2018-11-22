/**
 * Created by leaf4monkey on 04/09/2018
 */
const config = require('./config');
const GG = require('./gnat-grpc');
const utils = require('./utils');

const {check} = utils;
const {strOpt: checkStrOpt} = check;

const methodsHandler = function (ctx, methods) {
    const {Metadata} = config.grpc;
    const coll = {};
    Object.keys(methods).forEach(name => {
        const fn = methods[name];
        coll[name] = async function (call, callback) {
            ctx.emit('request', ctx, call);
            let ret;
            let err;
            let trailer;
            const setTrailer = obj => {
                if (obj instanceof Metadata) {
                    trailer = obj;
                    return obj;
                }
                trailer = trailer || new Metadata();
                Object.keys(obj).forEach(key => trailer.set(key, obj[key]));
                return trailer;
            };
            let flags;
            const setFlags = obj => flags = obj;
            let {request, metadata} = call;
            if (metadata instanceof Metadata) {
                metadata = metadata.getMap();
            }
            const o = {fn, call, setTrailer, setFlags, metadata, request, context: coll};
            try {
                ret = await o.fn(request, metadata, {setTrailer, setFlags}, call);
                ctx.emit('response', ctx, ret, trailer, flags);
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
        opts.isServer = true;
        super(opts);
        // if (!opts.credentials) {
        //     console.warn('`opts.credentials` is not set, an insecure one will be used.');
        // }
        checkStrOpt(opts, 'bindPath');

        this.server = new config.grpc.Server();
        this._options = opts;
        this[svcMappingSym] = [];
        this[servicesSym] = {};
        this._loadPlugins();
    }

    _svcMappingHandler (svcMapping) {
        return svcMapping.map(({pkg, name, Svc}) => {
            const key = GG._getServiceKey({pkgName: pkg, service: name});
            const obj = {service: Svc.service, key};
            this[svcMappingSym].push(obj);
            this[servicesSym][key] = Svc.service;
            return obj;
        });
    }

    async _loadDefinition (opts) {
        return this._svcMappingHandler(
            await super._loadDefinition(opts)
        );
    }

    _loadDefinitionSync (opts) {
        return this._svcMappingHandler(
            super._loadDefinitionSync(opts)
        );
    }

    addMethods (key, methods) {
        const handledMethods = methodsHandler(this, methods);
        this.server.addService(this[servicesSym][key], handledMethods);
        return this;
    }

    async registerService (opts, methods) {
        const mapping = await this._loadDefinition(opts);
        mapping.map(({key}) => this.addMethods(key, methods));
    }

    registerServiceSync (opts, methods) {
        const mapping = this._loadDefinitionSync(opts);
        mapping.map(({key}) => this.addMethods(key, methods));
    }

    start (...args) {
        const opts = this._options;
        this.server.bind(opts.bindPath, opts.credentials || config.grpc.ServerCredentials.createInsecure());
        const server = this.server.start(...args);
        this.emit('postServerReady', this, this);
        return server;
    }

    async _close () {
        return new Promise((resolve, reject) =>
            this.server.tryShutdown((err, res) => {
                err ? reject(err) : resolve(res);
            })
        );
    }

    async tryShutdown () {
        return this.close();
    }

    loadMethodsTree (methods) {
        methods && Object.keys(methods).forEach(key => this.addMethods(key, methods[key]));
    }

    static async addServer (configs, methods = configs.methods) {
        const server = new Server(configs);
        for (let cfg of configs.services) {
            cfg.events = Object.assign(cfg.events || {}, configs.events);
            await server._loadDefinition(cfg);
        }
        server.loadMethodsTree(methods);

        return server;
    }

    static addServerSync (configs, methods = configs.methods) {
        const server = new Server(configs);
        configs.services.forEach(cfg => server._loadDefinitionSync(cfg));
        server.loadMethodsTree(methods);

        return server;
    }
}

Server._utils = utils;

module.exports = Server;
