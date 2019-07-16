module.exports = (protobufjs) => {
    const {resolvePath} = protobufjs.Root.prototype;
    protobufjs.Root.prototype.resolvePath = function (originPath, includePath, ...args) {
        if (includePath.indexOf('google/protobuf/') === 0) {
            originPath = '';
        }
        return resolvePath.call(this, originPath, includePath, ...args);
    };
};
