/**
 * Created by leaf4monkey on 04/04/2018
 */
const config = require('../config');
const request = require('./request');

const loadFromString = (str, root, options) => {
    const {root: rootObj} = config.protobufjs.parse(str, root, options);
    return config.grpc.loadObject(rootObj);
};

/**
 * @deprecated
 * @param url
 * @param root
 * @param httpOpts
 * @param options
 * @returns {Promise.<void>}
 */
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

const loadByVer6 = (filename, root) =>
    new Promise((resolve, reject) => {
        config.protobufjs.load(filename, root, (err, res) => {
            err ? reject(err) : resolve(config.grpc.loadObject(res, {protobufjsVersion: 6}));
        });
    });

// const loadByVer5 = (...args) => config.grpc.load(...args);

const obj = {
    loadFromString,
    loadFromRemote,
    loadByVer6,
};

module.exports = obj;
