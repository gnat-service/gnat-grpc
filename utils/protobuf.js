/**
 * Created by leaf4monkey on 04/04/2018
 */
const config = require('../config');
const request = require('./request');

const loadFromString = (str, root, options) => {
    const {root: rootObj} = config.protobufjs.parse(str, root, options);
    return config.grpc.loadObject(rootObj);
};
const loadFromRemote = async (url, root, httpOpts = {}, options = {}) => {
    Object.assign(
        {
            headers: {
                'Content-Type': 'text/plain'
            }
        }
    );
    const text = await request[options.method || 'get'](url, httpOpts);
    return loadFromString(text, root, options);
};

const obj = {
    loadFromString,
    loadFromRemote
};

module.exports = obj;
