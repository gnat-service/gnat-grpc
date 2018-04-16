/**
 * Created by leaf4monkey on 04/10/2018
 */
const config = require('./config');
const utils = require('./utils');

const {protobuf, check} = utils;
const {serviceConflict: checkServiceConflict, strOpt: checkStrOpt} = check;

class GnatGrpc {
    constructor () {
        this.services = {};
        this.root = new config.protobufjs.Root();
    }

    static _getServiceKey ({pkgName, service}) {
        return `${pkgName}.${service}`;
    }

    static _isServiceClient (ctr) {
        return ctr && ctr.name === 'ServiceClient';
    }

    _retrieveSvc (pkg, opts, pkgName = '') {
        const keys = Object.keys(pkg);
        const o = pkg;

        const arr = [];
        keys.forEach(name => {
            const Svc = o[name];

            if (GnatGrpc._isServiceClient(Svc)) {
                opts.pkgName = opts.pkgName || pkgName;
                const key = GnatGrpc._getServiceKey({pkgName, service: name});
                checkServiceConflict(this.services, key);
                this.services[key] = Svc;
                return arr.push({pkg: pkgName, name, Svc});
            }

            if (Svc && typeof Svc === 'object') {
                pkgName = pkgName ? `${pkgName}.${name}` : name;
                return arr.push(...this._retrieveSvc(Svc, opts, pkgName));
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

        this.pkg = opts.fileLocation === 'remote' ?
            await protobuf.loadFromRemote(opts.protoPath, this.root) :
            config.grpc.load(opts.protoPath);

        const arr = this._retrieveSvc(this.pkg, opts);
        // const arr = [];
        // Object.keys(this.pkg).forEach(pkgName => {
        //     const svcMap = this.pkg[pkgName];
        //
        //     Object.keys(svcMap)
        //         .forEach(name => {
        //             const Svc = svcMap[name];
        //             if (!GnatGrpc._isServiceClient(Svc)) {
        //                 return;
        //             }
        //             opts.pkgName = opts.pkgName || pkgName;
        //             const key = GnatGrpc._getServiceKey({pkgName, service: name});
        //             checkServiceConflict(this.services, key);
        //             this.services[key] = Svc;
        //             arr.push({pkg: pkgName, name, Svc});
        //         });
        // });

        return arr;
    }
}

module.exports = GnatGrpc;
