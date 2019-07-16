const clone = require('lodash.clone');

const transforms = {};

const wrap = (self, methodName, hook) => {
    const fn = self[methodName];
    if (fn._transformWrapped) {
        return;
    }

    const transform = (ctx, d, fullName, typeMapping, args) => {
        const hasTransform = transforms[fullName];
        if (hasTransform) {
            d = transforms[fullName][methodName].call(ctx, d, ...args);
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
            d = transform(this, clone(d), fullName, typeMapping, args);
        }

        let r = fn.call(this, d, ...args);

        if (hook === 'post') {
            return transform(this, r, fullName, typeMapping, args);
        }
        return r;
    };
    self[methodName]._transformWrapped = true;
};

exports.wrapTransformers = (protobufjs) => {
    const {setup} = protobufjs.Type.prototype;
    protobufjs.Type.prototype.setup = function () {
        setup.apply(this, arguments);
        wrap(this, 'fromObject', 'pre');
        wrap(this, 'toObject', 'post');
        return this;
    };
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
