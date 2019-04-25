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
    constructor (opts = {}, ...args) {
        opts.isServer = false;
        super(opts, ...args);
        this.clients = {};
        this.rawClients = {};
        this._clients = {};
        this[containerSym] = {};
        this._loadPlugins();
        this.grpc = Client.grpc;
        this._channelsRefresher = null;
    }

    _wrapMethods (key, Svc) {
        const self = this;
        const container = {};
        const isRpc = (attrs) =>
            ['path', 'originalName'].every(key => attrs.hasOwnProperty(key));
        const {service} = Svc;
        const ctx = this[containerSym][key];
        const svcClient = ctx.retrieveClient();

        Object.keys(service).forEach(name => {
            const attrs = service[name];
            const method = svcClient[name];
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
                        const svcClient = ctx.retrieveClient();
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
                            const result = svcClient[name](...args);
                            self.emit('response', self, result);
                            return result;
                        }
                        return new Promise((resolve, reject) => {
                            svcClient[name](...args, (err, res, ...argus) => {
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

    _initRawClient (key, Svc, opts) {
        const ctx = this[containerSym][key];
        let c = ctx.client;
        if (!c) {
            c = new Svc(opts.bindPath, opts.credentials || this.grpc.credentials.createInsecure(), opts.channelOptions);
            ctx.client = c;
            this[containerSym][key].openedAt = Date.now();
        }
        return c;
    }

    _immediatelyRefresh (ctx) {
        if (typeof ctx === 'string') {
            ctx = this[containerSym][ctx];
        }
        if (!ctx) {
            return;
        }

        const {client} = ctx;
        ctx.client = null;
        ctx.openedAt = null;

        client && this.shutdownLegacyAfterMs &&
            setTimeout(() => this._closeClient(client), this.shutdownLegacyAfterMs);
    }

    startRefreshingChannels (opts) {
        this._stopRefreshChannels();

        const defOpts = {
            shutdownLegacyAfterMs: 60000,
            refreshAfterMs: 240000,
            checkLegacyIntervalMs: 30000,
        };
        const options = Object.assign(defOpts, this, opts);
        Object.assign(this, options);

        const container = this[containerSym];
        const now = Date.now();
        this._channelsRefresher = setInterval(() => {
            Object.keys(container).forEach(key => {
                const ctx = container[key];
                const {openedAt} = ctx;
                if (!openedAt) {
                    return;
                }
                if (now - openedAt > this.refreshAfterMs) {
                    this._immediatelyRefresh(ctx);
                }
            });
        }, this.checkLegacyIntervalMs);
    }

    _stopRefreshChannels () {
        if (this._channelsRefresher === null) {
            clearInterval(this._channelsRefresher);
            this._channelsRefresher = null;
        }
    }

    _checkout (opts, metadata, callOptions, svcMapping) {
        const arr = svcMapping.map(({pkg, name, Svc}) => {
            const key = GG._getServiceKey({pkgName: pkg, service: name});

            if (this.clients.hasOwnProperty(key)) {
                return;
            }

            const o = {metadata, callOptions};
            this[containerSym][key] = o;

            const retrieveClient = () => this._initRawClient(key, Svc, opts);
            const retrieveWrappedClient = () => {
                const ctx = this[containerSym][key];
                let c = ctx.wrappedClient;
                if (!c) {
                    c = this._wrapMethods(key, Svc);
                    ctx.wrappedClient = c;
                }
                return c;
            };
            o.retrieveClient = retrieveClient;
            o.retrieveWrappedClient = retrieveWrappedClient;

            Object.defineProperty(this.rawClients, key, {get: retrieveClient});
            Object.defineProperty(this.clients, key, {get: retrieveWrappedClient});

            return retrieveWrappedClient;
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

    _closeClient (client) {
        const close = () => {
            try {
                client.close();
            } catch (e) {
                // do nothing
            }
        };
        if (typeof client === 'string') {
            const ctx = this[containerSym][client];
            const {openedAt} = ctx;
            client = ctx.client;
            openedAt && close();
        } else {
            close();
        }
    }

    _close () {
        const container = this[containerSym];
        Object.keys(container).forEach(key =>
            this._closeClient(key)
        );
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
