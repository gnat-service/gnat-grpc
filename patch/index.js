/**
 * Created by leaf4monkey on 04/19/2018
 */

exports.protobufjs = protobufjs => {
    const {resolvePath} = protobufjs.Root.prototype;
    protobufjs.Root.prototype.resolvePath = function (originPath, includePath, ...args) {
        if (includePath.indexOf('google/protobuf/') === 0) {
            originPath = '';
        }
        return resolvePath.call(this, originPath, includePath, ...args);
    };
};
