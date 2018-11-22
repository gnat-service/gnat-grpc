/**
 * Created by leaf4monkey on 04/10/2018
 */
const config = require('./config');
const utils = require('./utils');
const EventEmitter = require('events');
const get = require('lodash.get');

const {loader, check} = utils;
const {/*serviceConflict: checkServiceConflict, */strOpt: checkStrOpt} = check;
const plugins = [];
const globalEvents = [];
const isServerSym = Symbol('isServer');

const optsHandler = (opts, cb) => {
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

    return opts;
};

class GnatGrpc extends EventEmitter {
    constructor ({events = [], isServer} = {}) {
        super();
        this.services = {};
        this.roots = {};
        this[isServerSym] = !!isServer;
        // this.root = new config.protobufjs.Root();
        this._registerEvts({events: globalEvents});
        this._registerEvts({events});
    }

    get isServer () {
        return this[isServerSym];
    }

    get isClient () {
        return !this[isServerSym];
    }

    static _getServiceKey ({pkgName, service}) {
        return `${pkgName}.${service}`;
    }

    static _splitServiceKey (key) {
        return key.match(/(.+)\.([^.]+)/).slice(1, 3);
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

    close () {
        this.emit('close');
        return this._close();
    }

    static registerPlugins (plugin) {
        const tp = typeof plugin;
        if (tp !== 'function') {
            throw new TypeError(`Expect \`plugin\` to be a function, got a "${tp}".`);
        }
        plugins.push(plugin);
    }

    static on (event, handler) {
        globalEvents.push({event, handler});
    }

    _loadPlugins () {
        plugins.forEach(plugin => plugin(this));
    }

    _registerSvc (key, Svc) {
        this.services[key] = Svc;
        this.emit('postRegisterService', this, key, Svc);
        return this;
    }

    _registerEvts ({events} = {}) {
        if (Array.isArray(events)) {
            return events.forEach(({event, handler}) => this.on(event, handler));
        }
        events && Object.keys(events).forEach(key =>
            this.on(key, events[key])
        );
    }

    static _execDefinitionFn (name, opts) {
        opts = optsHandler(opts);
        return config.protoLoader[name](opts.protoPath, opts.loadOpts);
    }

    _parseDefPkg (pkg) {
        const paths = Object.keys(pkg);

        const result = config.grpc.loadPackageDefinition(pkg);
        const arr = [];
        paths.forEach(path => {
            const Svc = get(result, path);
            const [pkgName, name] = GnatGrpc._splitServiceKey(path);
            arr.push({pkg: pkgName, name, Svc});
            this._registerSvc(path, Svc);
        });
        return arr;
    }

    _loadDefinitionSync (opts) {
        const pkg = GnatGrpc._execDefinitionFn('loadSync', opts);
        return this._parseDefPkg(pkg);
    }

    async _loadDefinition (opts) {
        const pkg = await GnatGrpc._execDefinitionFn('load', opts);
        return this._parseDefPkg(pkg);
    }
}

module.exports = GnatGrpc;
