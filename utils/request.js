/**
 * Created by leaf4monkey on 04/04/2018
 */

const request = require('request');

const req = (...args) =>
    new Promise((resolve, reject) =>
        request(...args, (err, res, body) => {
            if (err) {
                return reject(err);
            }
            resolve(body);
        })
    );

[
    'get',
    'post',
    'options',
    'post',
    'put',
    'patch',
    'delete'
].forEach(method => {
    req[method] = (uri, options) => {
        options = options || {};
        options.method = method.toUpperCase();
        return req(uri, options);
    };
});

req.del = req.delete;

module.exports = req;
