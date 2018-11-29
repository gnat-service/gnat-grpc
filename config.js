/**
 * Created by leaf4monkey on 04/11/2018
 */
const PATH = require('path');
const patch = require('./patch');

const cache = {
    grpc: null,
    protoLoader: null,
    root: null,
    protoDir: '.proto',
    cwd: process.cwd(),
    CUSTOM_ERR_CODE_OFFSET: 100,
    logger: console,
    defaultLoaderOpts: null,
};

const getConfigured = name => {
    const o = cache[name];
    if (!o) {
        throw new Error(`\`${name}\` is not configured yet.`);
    }
    return o;
};

const addTransforms = (transformsSet) => {
    (transformsSet || []).forEach(({transforms, fullName}) =>
        patch.setTransform(fullName, transforms)
    );
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

        configuration.defaultLoaderOpts = Object.assign(
            {
                keepCase: true,
                enums: String,
                defaults: true,
                oneofs: true
            },
            configuration.defaultLoaderOpts
        );

        Object.keys(cache).forEach(key => {
            if (!configuration.hasOwnProperty(key)) {
                return;
            }
            cache[key] = configuration[key] || cache[key];
        });

        cache.CUSTOM_ERR_CODE_OFFSET = cache.CUSTOM_ERR_CODE_OFFSET || configuration.customErrCodeOffset;
        cache.root = cache.root || PATH.join(cache.cwd, cache.protoDir);

        let protobufjs;
        try {
            protobufjs = require('@grpc/proto-loader/node_modules/protobufjs');
        } catch (e) {
            protobufjs = require('protobufjs');
        }
        cache.protobufjs = protobufjs;
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
        addTransforms(transformsSet);
    },

    addTransforms,

    _getPath (filename) {
        return PATH.join(getConfigured('root'), filename);
    },
    has (name) {
        return !!cache[name];
    },
    get grpc () {
        return getConfigured('grpc');
    },
    get protobufjs () {
        return getConfigured('protobufjs');
    },
    get protoLoader () {
        return getConfigured('protoLoader');
    },
    get root () {
        return getConfigured('root');
    },
    get customErrCodeOffset () {
        return getConfigured('CUSTOM_ERR_CODE_OFFSET');
    },
    get logger () {
        return getConfigured('logger');
    },
    get defaultLoaderOpts () {
        return getConfigured('defaultLoaderOpts');
    }
};
