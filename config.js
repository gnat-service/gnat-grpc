/**
 * Created by leaf4monkey on 04/11/2018
 */
const PATH = require('path');
const patch = require('./patch');

let _grpc;
let _protobufjs;
let _root;
let CUSTOM_ERR_CODE_OFFSET = 100;

const getConfigured = (o, name) => {
    if (!o) {
        throw new Error(`Module ${name} is not configured yet.`);
    }
    return o;
};

module.exports = {
    _config: ({
        grpc,
        protobufjs,
        root,
        customErrCodeOffset,
        defaultParseOpts,
        wrapDate = true,
        wrapBaseType = true,
        wrappersSet
    }) => {
        _grpc = grpc;
        _protobufjs = protobufjs;
        _root = root;
        CUSTOM_ERR_CODE_OFFSET = customErrCodeOffset || CUSTOM_ERR_CODE_OFFSET;

        patch.protobufjs(getConfigured(protobufjs, 'protobufjs'));

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
            ].forEach(type => patch.wrapBaseType(protobufjs, type));
        }
        wrapDate && patch.wrapDate(protobufjs);
        patch.setDftParseOpts(protobufjs, defaultParseOpts);
        wrappersSet = wrappersSet || [];
        wrappersSet.forEach(({wrappers, fullName}) =>
            patch.setWrapper(protobufjs, fullName, wrappers)
        );
    },
    _getPath (filename) {
        return PATH.join(_root, filename);
    },
    get grpc () {
        return getConfigured(_grpc, 'grpc');
    },
    get protobufjs () {
        return getConfigured(_protobufjs, 'protobufjs');
    },
    get root () {
        return getConfigured(_root, 'root');
    },
    get customErrCodeOffset () {
        return CUSTOM_ERR_CODE_OFFSET;
    }
};
