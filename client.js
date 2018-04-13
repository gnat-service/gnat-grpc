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
                const callback = args[args[len - 1]];
                if (len && isFn(callback)) {
                    return client[name](...args);
                }
                return new Promise((resolve, reject) => {
                    client[name](...args, (err, res) => {
                        err ? reject(err) : resolve(res);
                    });
                });
            }
        });

        return container;
    }

    async checkout (opts) {
        opts = Object.assign(
            {fileLocation: 'local'},
            opts
        );
        checkStrOpt(opts, 'bindPath');
        checkStrOpt(opts, 'fileLocation');
        checkStrOpt(opts, 'protoPath');
        checkStrOpt(opts, 'pkgName');
        checkStrOpt(opts, 'service');
        if (!opts.credentials) {
            console.warn('`opts.credentials` is not set, an insecure one will be used.');
        }

        const key = GG._getServiceKey(opts);
        const Svc = await this._loadProto(opts);

        const client = new Svc(opts.bindPath, opts.credentials || config.grpc.credentials.createInsecure());
        this.rawClients[key] = client;

        const wrappedClient = this._wrapMethods(client, Svc);
        this.clients[key] = wrappedClient;

        return wrappedClient;
    }

    getService (opts) {
        const key = typeof opts === 'string' ? opts : GG._getServiceKey(opts);
        return this.clients[key];
    }
}

module.exports = Client;
