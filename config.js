/**
 * Created by leaf4monkey on 04/11/2018
 */
const PATH = require('path');

let _grpc;
let _protobufjs;
let _root;
let ERR_CODE_OFFSET = 100;

const getConfigured = (o, name) => {
    if (!o) {
        throw new Error(`Module ${name} is not configured yet.`);
    }
    return o;
};

module.exports = {
    _config: ({grpc, protobufjs, root, errCodeOffset}) => {
        _grpc = grpc;
        _protobufjs = protobufjs;
        _root = root;
        ERR_CODE_OFFSET = errCodeOffset || ERR_CODE_OFFSET;
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
    get errCodeOffset () {
        return ERR_CODE_OFFSET;
    }
};
