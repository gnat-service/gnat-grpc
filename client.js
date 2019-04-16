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
const getGrpcClient = () =>
    config.has('grpcClient') ? config.grpcClient : config.grpc;

const checkoutOptsChecker = opts => {
    checkStrOpt(opts, 'bindPath');
    // if (!opts.credentials) {
    //     config.logger.warn('`opts.credentials` is not set, an insecure one will be used.');
    // }
};

class Client extends GG {
    constructor (...args) {
        !args.length && args.push({});
        args[0].isServer = false;
        super(...args);
        this.clients = {};
        this.rawClients = {};
        this._clients = {};
        this._rawClients = {};
        this[containerSym] = {};
        this._loadPlugins();
        this.grpc = Client.grpc;
    }

    _wrapMethods (client, Svc, key) {
        const self = this;
        const container = {};
        const isRpc = (attrs) =>
            ['path', 'originalName'].every(key => attrs.hasOwnProperty(key));
        const {service} = Svc;

        Object.keys(service).forEach(name => {
            const attrs = service[name];
            const method = client[name];
            if (!isRpc(attrs) || !isFn(method)) {
                return;
            }
            if (attrs.path.indexOf(name) > 0) { // 检查方法名是否与 url path 一致，如果是，则更改为 originalName
                name = attrs.originalName;
            }

            Object.assign(
                container,
                {
                    [name] (...args) {
                        const len = args.length;
                        if (!len) {
                            args = [{}];
                        }

                        if (args.length < 2) {
                            args.splice(1, 0, self.getMetadata(key));
                        } else {
                            args[1] = self.getMetadata(key, args[1]);
                        }

                        if (args.length < 3 || typeof args[2] !== 'object') {
                            args.splice(2, 0, self._getCallOpts(key));
                        } else {
                            args[2] = self._getCallOpts(key, args[2]);
                        }

                        self.emit('request', self, ...args);

                        const callback = args[len - 1];
                        if (len && isFn(callback)) {
                            const result = client[name](...args);
                            self.emit('response', self, result);
                            return result;
                        }
                        return new Promise((resolve, reject) => {
                            client[name](...args, (err, res, ...argus) => {
                                if (err) {
                                    reject(GG._safeUnescapedError(err));
                                } else {
                                    self.emit('response', self, res, ...argus);
                                    resolve(res);
                                }
                            });
                        });
                    }
                }
            );
        });

        return container;
    }

    _getCallOpts (key, obj) {
        return Object.assign({}, this[containerSym][key].callOptions || {}, obj);
    }

    getMetadata (key, obj) {
        let metadata;
        const {Metadata} = this.grpc;
        if (obj instanceof Metadata) {
            [metadata, obj] = [obj, null];
        } else {
            metadata = new Metadata();
        }
        const ctx = this[containerSym][key];
        obj = Object.assign({service: key, 'x-gnat-grpc-service': key}, ctx.metadata, obj);
        Object.keys(obj).forEach(k =>
            metadata.set(k, obj[k])
        );
        return metadata;
    }

    _checkout (opts, metadata, callOptions, svcMapping) {
        const arr = svcMapping.map(({pkg, name, Svc}) => {
            const key = GG._getServiceKey({pkgName: pkg, service: name});

            if (this.clients.hasOwnProperty(key)) {
                return;
            }

            const o = {metadata, callOptions};
            this[containerSym][key] = o;

            const getSvcClient = () => {
                let c = this._rawClients[key];
                if (!c) {
                    c = new Svc(opts.bindPath, opts.credentials || this.grpc.credentials.createInsecure(), opts.channelOptions);
                    this._rawClients[key] = c;
                }
                return c;
            };
            const getWrappedClient = () => {
                let c = this._clients[key];
                if (!c) {
                    const svcClient = this.rawClients[key];
                    c = this._wrapMethods(svcClient, Svc, key);
                    this._clients[key] = c;
                }
                return c;
            };

            Object.defineProperty(this.rawClients, key, {get: getSvcClient});
            Object.defineProperty(this.clients, key, {get: getWrappedClient});
            Object.defineProperties(o, {
                rawClient: {
                    get () {
                        return this.rawClients[key];
                    }
                },
                client: {
                    get () {
                        this.clients[key];
                    }
                }
            });
            return getWrappedClient;
        });

        const result = arr.length === 1 ? arr[0] : arr;
        this.emit('postServicesReady', this, arr);
        return result;
    }

    checkoutSyncLazy (opts, metadata = {}, callOptions) {
        checkoutOptsChecker(opts);
        const svcMapping = this._loadDefinitionSync(opts);
        return this._checkout(opts, metadata, callOptions, svcMapping);
    }

    async checkoutLazy (opts, metadata = {}, callOptions) {
        checkoutOptsChecker(opts);
        const svcMapping = await this._loadDefinition(opts);
        return this._checkout(opts, metadata, callOptions, svcMapping);
    }

    checkoutSync (...args) {
        return this.checkoutSyncLazy(...args)();
    }

    async checkout (...args) {
        const fn = await this.checkoutLazy(...args);
        return fn();
    }

    getService (opts) {
        const key = typeof opts === 'string' ? opts : GG._getServiceKey(opts);
        return this.clients[key];
    }

    _close () {
        Object.keys(this.rawClients).forEach(key => {
            const c = this.rawClients[key];
            if (c && isFn(c.close)) {
                c.close();
            }
        });
    }

    static get grpc () {
        return getGrpcClient();
    }

    static on (event, handler) {
        GG.on('client', event, handler);
    }

    static getInstance (...args) {
        return new Client(...args);
    }

    static _checkoutServices ({bindPath, credentials, channelOptions, services, metadata, callOptions, events}, fn) {
        const client = this.getInstance({events});
        const result = [];
        for (let svcOpts of services) {
            const meta = Object.assign({}, metadata, svcOpts.metadata);
            const callOpts = Object.assign({}, callOptions, svcOpts.callOptions);
            result.push(
                fn(client, Object.assign({bindPath, credentials, channelOptions}, svcOpts), meta, callOpts)
            );
        }
        return {client, services: result};
    }

    static async checkoutServices (opts) {
        const {client, services: promises} = this._checkoutServices(
            opts,
            (self, ...args) => self.checkoutLazy(...args)
        );
        await Promise.all(promises);
        return client;
    }

    static checkoutServicesSync (opts) {
        const {client} = this._checkoutServices(
            opts,
            (self, ...args) => self.checkoutSyncLazy(...args)
        );
        return client;
    }
}

module.exports = Client;
