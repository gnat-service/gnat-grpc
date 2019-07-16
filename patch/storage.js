module.exports = (protobufjs, storage) => {
    if (storage) {
        const {fetch} = protobufjs.util;
        protobufjs.util.fetch = function (filename, options, callback) {
            const rawFetch = () => fetch.call(this, filename, options, callback);
            return storage.handler(rawFetch, filename, options, callback);
        };
    }
};
