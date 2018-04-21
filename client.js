/**
 * Created by leaf4monkey on 04/10/2018
 */
const GG = require('./gnat-grpc');
const config = require('./config');
const utils = require('./utils');

const {check} = utils;
const {strOpt: checkStrOpt} = check;

const isFn = fn => typeof fn === 'function';

class Client extends GG {
    constructor () {
        super();
        this.clients = {};
        this.rawClients = {};
    }

    _wrapMethods (client, Svc) {
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
                const callback = args[len - 1];
                if (len && isFn(callback)) {
                    return client[name](...args);
                }
                return new Promise((resolve, reject) => {
                    client[name](...args, (err, res) => {
                        if (err) {
                            reject(GG._unescapedError(err));
                        } else {
                            resolve(res);
                        }
                    });
                });
            }
        });

        return container;
    }

    async checkout (opts) {
        checkStrOpt(opts, 'bindPath');
        if (!opts.credentials) {
            console.warn('`opts.credentials` is not set, an insecure one will be used.');
        }

        const svcMapping = await this._loadProto(opts);

        const arr = svcMapping.map(({pkg, name, Svc}) => {
            const key = GG._getServiceKey({pkgName: pkg, service: name});
            const client = new Svc(opts.bindPath, opts.credentials || config.grpc.credentials.createInsecure());
            this.rawClients[key] = client;

            const wrappedClient = this._wrapMethods(client, Svc);
            this.clients[key] = wrappedClient;
            return wrappedClient;
        });

        if (arr.length === 1) {
            return arr[0];
        }

        return arr;
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

    static async checkoutServices ({bindPath, services}) {
        const client = new Client();
        for (let opts of services) {
            await client.checkout(Object.assign({bindPath}, opts));
        }
        // await Promise.all(
        //     services.map(opts => client.checkout(Object.assign({bindPath}, opts)))
        // );
        return client;
    }
}

module.exports = Client;
