/**
 * Created by leaf4monkey on 04/19/2018
 */
const converter = require('./converter');

const GOOGLE_PROTO_PRIFIX = 'google.protobuf.';
const getFullTypeName = name => `.${GOOGLE_PROTO_PRIFIX}${name}`;
const wrappedTypes = [
    'DoubleValue',
    'FloatValue',
    'Int64Value',
    'UInt64Value',
    'Int32Value',
    'UInt32Value',
    'BoolValue',
    'StringValue',
    // 'BytesValue'
];
const fullWrappedTypes = wrappedTypes.map(s => getFullTypeName(s));

const floatTypes = ['DoubleValue', 'FloatValue'];
const intTypes = ['Int64Value', 'UInt64Value', 'Int32Value', 'UInt32Value'];
const boolType = 'BoolValue';

exports.protobufjs = protobufjs => {
    converter._setProtobufjs(protobufjs);
    const {util, wrappers, Writer} = protobufjs;
    const {resolvePath} = protobufjs.Root.prototype;
    const {setup} = protobufjs.Type.prototype;

    protobufjs.Root.prototype.resolvePath = function (originPath, includePath, ...args) {
        if (includePath.indexOf('google/protobuf/') === 0) {
            originPath = '';
        }
        return resolvePath.call(this, originPath, includePath, ...args);
    };

    protobufjs.Type.prototype.setup = function () {
        setup.apply(this, arguments);
        const fullName = this.fullName;
        const types = this._fieldsArray.map(field => field.resolve().resolvedType);

        if (wrappers[fullName]) {
            return this;
        }

        this.fromObject = converter.fromObject(this)({
            types: types,
            util: util
        });
        return this;
    };
};

exports.wrapBaseType = (protobufjs, type) => {
    protobufjs.wrappers[getFullTypeName(type)] = {
        fromObject (o) {
            const t = typeof o;
            if (['number', 'string', 'boolean'].includes(t)) {
                return this.fromObject({value: o});
            }
            if (!o) {
                // return null;
                return {value: null};
            }
            return this.fromObject(o);
        },
        toObject (m/*, o*/) {
            if (!m && m !== false) {
                return m;
            }
            const name = m.constructor.name;
            if (floatTypes.includes(name)) {
                return parseFloat(m.value);
            }
            if (intTypes.includes(name)) {
                return parseInt(m.value, 10);
            }
            return m.value;
        }
    };
};

exports.wrapDate = protobufjs => {
    protobufjs.wrappers[getFullTypeName('Timestamp')] = {
        fromObject (o) {
            if (!o && o !== 0) {
                return {};
            }
            if (['seconds', 'nanos'].some(key => typeof o[key] === 'number')) {
                return this.fromObject(o);
            }
            const d = new Date(o);
            const millis = d.getTime();
            const nanos = millis % 1000;
            const seconds = (millis - nanos) / 1000;
            return {seconds, nanos};
        },
        toObject (m, o) {
            o = o || {};
            if (!m) {
                return m;
            }
            if (!m.seconds && m.seconds !== 0 && typeof m.nanos !== 'number') {
                return null;
            }

            const seconds = parseInt(m.seconds || 0, 10);
            return new Date(seconds * 1000 + (m.nanos || 0));
        }
    }
};

exports.setDftParseOpts = (protobufjs, opts) => {
    protobufjs.parse.defaults = protobufjs.parse.defaults || {};
    Object.assign(protobufjs.parse.defaults, {keepCase: true}, opts);
};

exports.setWrapper = (protobufjs, fullName, wrappers) => {
    if (!wrappers) {
        throw new TypeError(`Expect an object, got an empty value.`);
    }
    if (['fromObject', 'toObject'].some(f => !wrappers[f])) {
        throw new TypeError(`Expect both \`wrapper.fromObject\` \`wrapper.toObject\` to be functions.`);
    }
    protobufjs.wrappers[fullName] = wrappers;
};
