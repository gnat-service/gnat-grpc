/**
 * Created by leaf4monkey on 04/11/2018
 */
const PATH = require('path');

let _grpc;
let _protobufjs;
let _root;

const getConfigured = (o, name) => {
    if (!o) {
        throw new Error(`Module ${name} is not configured yet.`);
    }
    return o;
};

module.exports = {
    _config: ({grpc, protobufjs, root}) => {
        _grpc = grpc;
        _protobufjs = protobufjs;
        _root = root;
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
    }
};
