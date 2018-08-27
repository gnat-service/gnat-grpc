/**
 * Created by leaf4monkey on 04/10/2018
 */
const GG = require('./gnat-grpc');
const config = require('./config');
const utils = require('./utils');

const {check} = utils;
const {strOpt: checkStrOpt} = check;
const containerSym = Symbol('container');

const isFn = fn => typeof fn === 'function';

const checkoutOptsChecker = opts => {
    checkStrOpt(opts, 'bindPath');
    if (!opts.credentials) {
        console.warn('`opts.credentials` is not set, an insecure one will be used.');
    }
};

class Client extends GG {
    constructor () {
        super();
        this.clients = {};
        this.rawClients = {};
        this[containerSym] = {};
    }

    _wrapMethods (client, Svc, key) {
        const self = this;
        const container = {};
        const isRpc = (attrs) =>
            ['path', 'originalName'].every(key => attrs.hasOwnProperty(key));
        const {service} = Svc;

        Object.keys(service).forEach(name => {
            const method = client[name];
            const attrs = service[name];
            if (!isRpc(attrs) || !isFn(method)) {
                return;
            }

            container[name] = function (...args) {
                const len = args.length;
                if (!len) {
                    args = [{}];
                }

                if (args.length < 2 || typeof args[1] !== 'object') {
                    args.splice(1, 0, self.getMetadata(key));
                } else {
                    args[1] = self.getMetadata(key, args[1]);
                }

                if (args.length < 3 || typeof args[2] !== 'object') {
                    args.splice(2, 0, self._getCallOpts(key));
                } else {
                    args[2] = self._getCallOpts(key, args[2]);
                }

                const callback = args[len - 1];
                if (len && isFn(callback)) {
                    return client[name](...args);
                }
                return new Promise((resolve, reject) => {
                    client[name](...args, (err, res, ...argus) => {
                        if (err) {
                            reject(GG._unescapedError(err));
                        } else {
                            resolve(res);
                        }
                    });
                });
            };
            container.name = name;
        });

        return container;
    }

    _getCallOpts (key, obj) {
        return Object.assign({}, this[containerSym][key].callOptions || {}, obj);
    }

    getMetadata (key, obj) {
        let metadata;
        if (obj instanceof config.grpc.Metadata) {
            [metadata, obj] = [obj, null];
        } else {
            metadata = new config.grpc.Metadata()
        }
        const ctx = this[containerSym][key];
        obj = Object.assign({service: key}, ctx.metadata, obj);
        Object.keys(obj).forEach(k =>
            metadata.set(k, obj[k])
        );
        return metadata;
    }

    _checkout (opts, metadata, callOptions, svcMapping) {
        const arr = svcMapping.map(({pkg, name, Svc}) => {
            const key = GG._getServiceKey({pkgName: pkg, service: name});
            const client = new Svc(opts.bindPath, opts.credentials || config.grpc.credentials.createInsecure());
            this.rawClients[key] = client;

            const wrappedClient = this._wrapMethods(client, Svc, key);
            this.clients[key] = wrappedClient;
            this[containerSym][key] = {rawClient: client, client: wrappedClient, metadata, callOptions};
            return wrappedClient;
        });

        if (arr.length === 1) {
            return arr[0];
        }

        return arr;
    }

    checkoutSync (opts, metadata = {}, callOptions) {
        checkoutOptsChecker(opts);
        const svcMapping = this._loadProtoSync(opts);
        return this._checkout(opts, metadata, callOptions, svcMapping);
    }

    async checkout (opts, metadata = {}, callOptions) {
        checkoutOptsChecker(opts);
        const svcMapping = await this._loadProto(opts);
        return this._checkout(opts, metadata, callOptions, svcMapping);
    }

    getService (opts) {
        const key = typeof opts === 'string' ? opts : GG._getServiceKey(opts);
        return this.clients[key];
    }

    close () {
        Object.keys(this.rawClients).forEach(key => {
            const c = this.rawClients[key];
            if (c && isFn(c.close)) {
                c.close();
            }
        });
    }

    static async checkoutServices ({bindPath, services, metadata, callOptions}) {
        const client = new Client();
        for (let opts of services) {
            const meta = Object.assign({}, metadata, opts.metadata);
            const callOpts = Object.assign({}, callOptions, opts.callOptions);
            await client.checkout(Object.assign({bindPath}, opts, meta, callOpts));
        }
        // await Promise.all(
        //     services.map(opts => client.checkout(Object.assign({bindPath}, opts)))
        // );
        return client;
    }

    static checkoutServicesSync ({bindPath, services, metadata, callOptions}) {
        const client = new Client();
        for (let opts of services) {
            const meta = Object.assign({}, metadata, opts.metadata);
            const callOpts = Object.assign({}, callOptions, opts.callOptions);
            client.checkoutSync(Object.assign({bindPath}, opts, meta, callOpts));
        }
        return client;
    }
}

module.exports = Client;
