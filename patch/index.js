const wrapStorage = require('./storage');
const wrapResolver = require('./resolver');
const wrapper = require('./wrapper');

const GOOGLE_PROTO_PRIFIX = 'google.protobuf.';
const getFullTypeVal = name => `${GOOGLE_PROTO_PRIFIX}${name}`;
const getFullTypeName = name => `.${getFullTypeVal(name)}`;
const {setTransform, setWrapper} = wrapper;

const floatTypes = ['DoubleValue', 'FloatValue'].map(getFullTypeVal);
const intTypes = ['Int64Value', 'UInt64Value', 'Int32Value', 'UInt32Value'].map(getFullTypeVal);
const boolTypes = ['BoolValue'].map(getFullTypeVal);
// const dateTypes = ['Timestamp'].map(getFullTypeVal);
[floatTypes, intTypes, boolTypes].forEach(typeArr => {
    typeArr.push(...typeArr.map(type => `.${type}`));
});

const isFloat = type => floatTypes.includes(type);
const isInt = type => intTypes.includes(type);
const isBool = type => boolTypes.includes(type);

const parseByType = (val, type) => {
    if (val === null) {
        return val;
    }
    if (isFloat(type)) {
        return parseFloat(val);
    }
    if (isInt(type)) {
        return parseInt(val, 10);
    }
    if (isBool(type)) {
        if (['true', 'false'].includes(val)) {
            return val === 'true';
        }
        return !!val;
    }
    return val;
};

exports.setProtoFetcher = (protobufjs, storage) => {
    wrapStorage(protobufjs, storage);
};

exports.protobufjs = (protobufjs, storage) => {
    wrapStorage(protobufjs, storage);
    wrapResolver(protobufjs);
    wrapper.wrapTransformers(protobufjs);
};

const normalizeTransform = (ctx, fn, o, ...args) => {
    if (ctx.repeated) {
        if (!o) {
            return o;
        }
        if (Array.isArray(o)) {
            return o.map(el => fn(el, ...args));
        }
    }

    if (ctx.map) {
        if (!o) {
            return o;
        }
        const oo = {};
        Object.keys(o).forEach((k) => {
            oo[k] = fn(o[k], ...args);
        });
        return oo;
    }

    return fn(o, ...args);
};

exports.wrapBaseType = type => {
    const fullName = getFullTypeName(type);
    const trans = {
        fromObject (o) {
            const fn = o => {
                const t = typeof o;
                if (['number', 'string', 'boolean'].includes(t)) {
                    return {value: o};
                }

                return o;
            };

            return normalizeTransform(this, fn, o);
        },
        toObject (m) {
            const fn = m => {
                const t = typeof m;
                if (['number', 'string', 'boolean'].includes(t)) {
                    return parseByType(m, fullName);
                }
                if (!m) {
                    return m;
                }

                return parseByType(m.value, fullName);
            };

            return normalizeTransform(this, fn, m);
        }
    };
    setTransform(fullName, trans);
};

exports.wrapDate = () => {
    const fullName = getFullTypeName('Timestamp');
    const trans = {
        fromObject (o) {
            const fn = o => {
                if (!o && o !== 0) {
                    return null;
                }

                if (['seconds', 'nanos'].some(key => typeof o[key] === 'number')) {
                    return o;
                }

                const millis = new Date(o).getTime();
                if (isNaN(millis)) {
                    throw new Error(`\`${o}\` cannot be parsed by \`Date.parse()\``);
                }

                const nanos = millis % 1000;
                const seconds = (millis - nanos) / 1000;
                return {seconds, nanos};
            };

            return normalizeTransform(this, fn, o);
        },

        toObject (m) {
            const fn = m => {
                if (!m) {
                    return m;
                }

                if (m instanceof Date) {
                    return m;
                }

                if (!m.seconds && m.seconds !== 0 && typeof m.nanos !== 'number') {
                    return null;
                }

                const seconds = parseInt(m.seconds || 0, 10);
                const nanos = parseInt(m.nanos || 0, 10);
                return new Date(seconds * 1000 + nanos);
            };

            return normalizeTransform(this, fn, m);
        }
    };
    setTransform(fullName, trans);
};

exports.setDftParseOpts = (protobufjs, opts) => {
    protobufjs.parse.defaults = protobufjs.parse.defaults || {};
    Object.assign(protobufjs.parse.defaults, {keepCase: true}, opts);
};

exports.setTransform = setTransform;

exports.setWrapper = setWrapper;
