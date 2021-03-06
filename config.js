/**
 * Created by leaf4monkey on 04/11/2018
 */
const PATH = require('path');
const patch = require('./patch');
const protoLoader = require('@grpc/proto-loader');

let grpc = null;
let grpcClient = null;
let protobufjs = null;

try {
    grpc = require('grpc');
} catch (e) {
    grpcClient = require('@grpc/grpc-js');
}
try {
    protobufjs = require('@grpc/proto-loader/node_modules/protobufjs');
} catch (e) {
    protobufjs = require('protobufjs');
}

let initialized = false;

const cache = {
    grpc,
    grpcClient,
    protoLoader,
    root: null,
    protoDir: '.proto',
    cwd: process.cwd(),
    CUSTOM_ERR_CODE_OFFSET: 100,
    logger: console,
    storage: null,
    logVerbosity: -1,
    defaultLoaderOpts: null,
    escapeErrorAnyway: false,
};

const getConfigured = name => {
    const o = cache[name];
    if ([null, undefined].includes(o)) {
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
        if (initialized) {
            return;
        }

        initialized = true;
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

        if (cache.grpc) {
            cache.grpc.setLogger(cache.logger);
            if (cache.logVerbosity >= 0) {
                cache.grpc.setLogVerbosity(cache.logVerbosity);
            }
        }

        cache.CUSTOM_ERR_CODE_OFFSET = cache.CUSTOM_ERR_CODE_OFFSET || configuration.customErrCodeOffset;
        cache.root = cache.root || PATH.join(cache.cwd, cache.protoDir);

        cache.protobufjs = protobufjs;
        patch.protobufjs(protobufjs, cache.storage);

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

    setProtoFetcher (storage) {
        patch.setProtoFetcher(protobufjs, storage);
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
    get grpcClient () {
        return getConfigured('grpcClient');
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
    },
    get escapeErrorAnyway () {
        return getConfigured('escapeErrorAnyway');
    },
    get initialized () {
        return initialized;
    }
};
