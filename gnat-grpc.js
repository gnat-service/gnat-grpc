/**
 * Created by leaf4monkey on 04/10/2018
 */
const config = require('./config');
const utils = require('./utils');
const EventEmitter = require('events');
const get = require('lodash.get');

const {check} = utils;
const {/*serviceConflict: checkServiceConflict, */strOpt: checkStrOpt} = check;
const plugins = [];
const globalEvents = {server: [], client: []};
const isServerSym = Symbol('isServer');

const optsHandler = opts => {
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

const needEscapeErr = () => {
    if (config.escapeErrorAnyway) {
        return true;
    }
    try {
        // grpc 1.17 或以下版本不能正确处理包含中文的字符串的长度，导致字串截断.
        // 经测试发现该问题已经在 1.18 以上版本中得到修复
        const {version} = require('grpc/package.json');
        return /^[01]\.(\d|1[0-7])\./.test(version); // 判断 grpc 版本是否为 1.17 或以下
    } catch (e) {
        return false;
    }
};

class GnatGrpc extends EventEmitter {
    constructor ({events = [], isServer} = {}) {
        super();
        this.services = {};
        this.roots = {};
        this[isServerSym] = !!isServer;
        // this.root = new config.protobufjs.Root();

        this._registerEvts({events: globalEvents[isServer ? 'server' : 'client']});
        this._registerEvts({events});
        // this.grpc = config.grpc;
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
        return ctr && ['ServiceClient', 'ServiceClientImpl'].includes(ctr.name);
    }

    static _isCustomErr (err) {
        return err.code > config.customErrCodeOffset;
    }

    static _escapedError (err) {
        err.message = Buffer.from(err.message).toString('base64');
        return err;
    }

    static _safeEscapedError (err) {
        if (GnatGrpc._isCustomErr(err) && needEscapeErr()) {
            err = GnatGrpc._escapedError(err);
        }
        return err;
    }

    static _unescapedError (err) {
        const {details} = err;
        err.details = Buffer.from(details, 'base64').toString('utf-8');
        err.message = err.message.replace(details, err.details);
        return err;
    }

    static _safeUnescapedError (err) {
        const {UNKNOWN} = GnatGrpc.grpc.status;
        const errCode = err.metadata && err.metadata.get('gnat-grpc-error-code');
        if (err.code === UNKNOWN && errCode && Array.isArray(errCode)) {
            err.code = parseInt(errCode[0], 10);
        }
        if (GnatGrpc._isCustomErr(err) && needEscapeErr()) {
            err = GnatGrpc._unescapedError(err);
        }
        return err;
    }

    static get grpc () {
        return config.has('grpc') ? config.grpc : config.grpcClient;
    }

    close () {
        this.emit('close', this);
        return this._close();
    }

    static registerPlugins (plugin) {
        const tp = typeof plugin;
        if (tp !== 'function') {
            throw new TypeError(`Expect \`plugin\` to be a function, got a "${tp}".`);
        }
        plugins.push(plugin);
    }

    static on (end, event, handler) {
        globalEvents[end].push({event, handler});
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

    static _getLoadingParams (opts) {
        opts = optsHandler(opts);
        let loadOpts = config.defaultLoaderOpts ?
            Object.assign(config.defaultLoaderOpts, opts.loadOpts) :
            opts.loadOpts;
        return {protoPath: opts.protoPath, loadOpts};
    }

    _parseDefPkg (pkg) {
        const paths = Object.keys(pkg);

        const result = this.grpc.loadPackageDefinition(pkg);
        const arr = [];
        paths.forEach(path => {
            const Svc = get(result, path);
            if (!GnatGrpc._isServiceClient(Svc)) {
                return;
            }

            const [pkgName, name] = GnatGrpc._splitServiceKey(path);
            arr.push({pkg: pkgName, name, Svc});
            this._registerSvc(path, Svc);
        });
        return arr;
    }

    _loadDefinitionSync (opts) {
        const {protoPath, loadOpts} = GnatGrpc._getLoadingParams(opts);
        const pkg = config.protoLoader.loadSync(protoPath, loadOpts);
        return this._parseDefPkg(pkg);
    }

    async _loadDefinition (opts) {
        const {protoPath, loadOpts} = GnatGrpc._getLoadingParams(opts);
        const pkg = await config.protoLoader.load(protoPath, loadOpts);
        return this._parseDefPkg(pkg);
    }
}

module.exports = GnatGrpc;
