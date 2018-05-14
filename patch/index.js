const clone = require('lodash.clone');

const GOOGLE_PROTO_PRIFIX = 'google.protobuf.';
const getFullTypeVal = name => `${GOOGLE_PROTO_PRIFIX}${name}`;
const getFullTypeName = name => `.${getFullTypeVal(name)}`;
const transforms = {};

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

const wrap = (self, methodName, hook) => {
    const fn = self[methodName];
    if (fn._transformWrapped) {
        return;
    }

    const transform = (d, fullName, typeMapping, args) => {
        const hasTransform = transforms[fullName];
        if (hasTransform) {
            d = transforms[fullName][methodName].call(this, d, ...args);
        }

        typeMapping.forEach(({name, resolvedType, field}) => {
            if (!resolvedType) {
                return;
            }
            const {fullName} = resolvedType;
            if (transforms[fullName]) {
                d[name] = transforms[fullName][methodName].call(field, d[name], ...args);
            }
        });
        return d;
    };

    self[methodName] = function (d, ...args) {
        const {fullName} = this;

        const typeMapping = this._fieldsArray.map(field => {
            const {resolvedType} = field.resolve();
            return {name: field.name, resolvedType, field};
        });
        if ([null, undefined].includes(d)) {
            return fn.call(this, d, ...args);
        }

        if (hook === 'pre') {
            d = transform(clone(d), fullName, typeMapping, args);
        }

        let r = fn.call(this, d, ...args);

        if (hook === 'post') {
            return transform(r, fullName, typeMapping, args);
        }
        return r;
    };
    self[methodName]._transformWrapped = true;
};

exports.protobufjs = protobufjs => {
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
        wrap(this, 'fromObject', 'pre');
        wrap(this, 'toObject', 'post');
        return this;
    };
};

const wrapTransform = (ctx, method, fullName, fn, o, ...args) => {
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

const wrapFromObjTrans = (ctx, ...args) => wrapTransform(ctx, 'fromObject', ...args);
const wrapToObjTrans = (ctx, ...args) => wrapTransform(ctx, 'toObject', ...args);

exports.wrapBaseType = type => {
    const fullName = getFullTypeName(type);
    transforms[fullName] = {
        fromObject (o) {
            const fn = o => {
                const t = typeof o;
                if (['number', 'string', 'boolean'].includes(t)) {
                    return {value: o};
                }

                return o;
            };

            return wrapFromObjTrans(this, fullName, fn, o);
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

            return wrapToObjTrans(this, fullName, fn, m);
        }
    };
};

exports.wrapDate = () => {
    const fullName = getFullTypeName('Timestamp');
    transforms[fullName] = {
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

            return wrapFromObjTrans(this, fullName, fn, o);
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

            return wrapToObjTrans(this, fullName, fn, m);
        }
    };
};

exports.setDftParseOpts = (protobufjs, opts) => {
    protobufjs.parse.defaults = protobufjs.parse.defaults || {};
    Object.assign(protobufjs.parse.defaults, {keepCase: true}, opts);
};

exports.setTransform = (fullName, trans) => {
    if (!trans) {
        throw new TypeError(`Expect an object, got an empty value.`);
    }
    if (['fromObject', 'toObject'].some(f => !trans[f])) {
        throw new TypeError(`Expect both \`transform.fromObject\` \`transform.toObject\` to be functions.`);
    }
    transforms[fullName] = trans;
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
