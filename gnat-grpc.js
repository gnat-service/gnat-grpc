/**
 * Created by leaf4monkey on 04/10/2018
 */
const config = require('./config');
const utils = require('./utils');

const {loader, check} = utils;
const {serviceConflict: checkServiceConflict, strOpt: checkStrOpt} = check;

class GnatGrpc {
    constructor () {
        this.services = {};
        this.roots = {};
        // this.root = new config.protobufjs.Root();
    }

    static _getServiceKey ({pkgName, service}) {
        return `${pkgName}.${service}`;
    }

    static _isServiceClient (ctr) {
        return ctr && ctr.name === 'ServiceClient';
    }

    static _isCustomErr (err) {
        return err.code > config.customErrCodeOffset;
    }

    static _escapedError (err) {
        if (GnatGrpc._isCustomErr(err)) {
            err.message = Buffer.from(err.message).toString('base64');
        }
        return err;
    }

    static _unescapedError (err) {
        if (GnatGrpc._isCustomErr(err)) {
            const {details} = err;
            err.details = Buffer.from(details, 'base64').toString('utf-8');
            err.message = err.message.replace(details, err.details);
        }
        return err;
    }

    _retrieveSvc (root, parent, opts, pkgName = '') {
        const keys = Object.keys(parent);

        const arr = [];
        keys.forEach(name => {
            const Svc = parent[name];

            if (GnatGrpc._isServiceClient(Svc)) {
                opts.pkgName = opts.pkgName || pkgName;
                const key = GnatGrpc._getServiceKey({pkgName, service: name});

                // Skip registered services.
                if (this.services[key]) {
                    return console.log(`Service ${key} already exists, skipped.`);
                }

                // checkServiceConflict(this.services, key);
                this.services[key] = Svc;
                this.roots[key] = root;
                return arr.push({pkg: pkgName, name, Svc});
            }

            if (Svc && typeof Svc === 'object' && Svc.constructor.name === 'Object') {
                return arr.push(...this._retrieveSvc(root, Svc, opts, pkgName ? `${pkgName}.${name}` : name));
            }
        });
        return arr;
    }

    async _loadProto (opts) {
        opts = Object.assign(
            {fileLocation: 'local'},
            opts
        );

        if (opts.filename) {
            opts.protoPath = config._getPath(opts.filename);
        }

        checkStrOpt(opts, 'fileLocation');
        checkStrOpt(opts, 'protoPath');
        checkStrOpt(opts, 'filename', false);
        checkStrOpt(opts, 'pkgName', false);
        checkStrOpt(opts, 'service', false);

        const root = new config.protobufjs.Root();
        const pkg = opts.fileLocation === 'remote' ?
            await loader.loadFromRemote(opts.protoPath, root) :
            await loader.loadByVer6(opts.protoPath, root);

        return this._retrieveSvc(root, pkg, opts);
    }
}

module.exports = GnatGrpc;
