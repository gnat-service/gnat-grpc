/**
 * Created by leaf4monkey on 04/04/2018
 */

const request = require('request');

const req = (method, ...args) =>
    new Promise((resolve, reject) =>
        request[method](...args, (err, res, body) => {
            if (err) {
                return reject(err);
            }
            resolve(body);
        })
    );

const methods = {};
[
    'get',
    'post',
    'options',
    'post',
    'put',
    'patch',
    'delete'
].forEach(method => {
    methods[method] = (uri, options) => {
        options = options || {};
        options.method = method.toUpperCase();
        return req(method, uri, options);
    };
});

methods.del = methods.delete;

module.exports = methods;
