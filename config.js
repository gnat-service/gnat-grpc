/**
 * Created by leaf4monkey on 04/11/2018
 */

let _grpc;
let _protobufjs;

const getConfigured = (o, name) => {
    if (!o) {
        throw new Error(`Module ${name} is not configured yet.`);
    }
    return o;
};

module.exports = {
    _config: ({grpc, protobufjs}) => {
        _grpc = grpc;
        _protobufjs = protobufjs;
    },
    get grpc () {
        return getConfigured(_grpc, 'grpc');
    },
    get protobufjs () {
        return getConfigured(_protobufjs, 'protobufjs');
    },
};
