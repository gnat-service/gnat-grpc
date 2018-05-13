/**
 * Created by leaf4monkey on 04/11/2018
 */
const PATH = require('path');
const patch = require('./patch');

const cache = {
    grpc: null,
    protobufjs: null,
    root: null,
    protoDir: '.proto',
    cwd: process.cwd(),
    CUSTOM_ERR_CODE_OFFSET: 100,
};

const getConfigured = name => {
    const o = cache[name];
    if (!o) {
        throw new Error(`\`${name}\` is not configured yet.`);
    }
    return o;
};

module.exports = {
    _config: (configuration = {}) => {
        const {
            defaultParseOpts,
            wrapDate = true,
            wrapBaseType = true,
            wrappersSet,
            transformsSet
        } = configuration;

        Object.keys(cache).forEach(key => {
            if (!configuration.hasOwnProperty(key)) {
                return;
            }
            cache[key] = configuration[key] || cache[key];
        });
        cache.CUSTOM_ERR_CODE_OFFSET = cache.CUSTOM_ERR_CODE_OFFSET || configuration.customErrCodeOffset;
        cache.root = cache.root || PATH.join(cache.cwd, cache.protoDir);

        const protobufjs = getConfigured('protobufjs');

        patch.protobufjs(protobufjs);

        if (wrapBaseType) {
            [
                'DoubleValue',
                'FloatValue',
                'Int64Value',
                'UInt64Value',
                'Int32Value',
                'UInt32Value',
                'BoolValue',
                'StringValue',
            ].forEach(patch.wrapBaseType);
        }
        wrapDate && patch.wrapDate();
        patch.setDftParseOpts(protobufjs, defaultParseOpts);
        (wrappersSet || []).forEach(({wrappers, fullName}) =>
            patch.setWrapper(protobufjs, fullName, wrappers)
        );
        (transformsSet || []).forEach(({transforms, fullName}) =>
            patch.setTransform(fullName, transforms)
        );
    },
    _getPath (filename) {
        return PATH.join(getConfigured('root'), filename);
    },
    get grpc () {
        return getConfigured('grpc');
    },
    get protobufjs () {
        return getConfigured('protobufjs');
    },
    get root () {
        return getConfigured('root');
    },
    get customErrCodeOffset () {
        return getConfigured('CUSTOM_ERR_CODE_OFFSET');
    }
};
