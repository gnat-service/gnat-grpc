/**
 * Created by leaf4monkey on 04/17/2018
 */

const db = require('./db');
const initData = require('./init-data');
const gnatGrpc = require('../../');
const grpc = require('grpc');
const protobufjs = require('protobufjs');
const PATH = require('path');
const _ = require('lodash');

const root = PATH.join(__dirname, '.proto');
const OrderProto = PATH.join(__dirname, '.proto/gnat/grpc/order.proto');
const PORT = 50051;

gnatGrpc.config({
    grpc,
    protobufjs,
    root
});

const {Server} = gnatGrpc;

const mongoose = require('mongoose');
const cloneDeepWith = (obj, callback) => _.cloneDeepWith(obj, callback);

const cb = function (value, key, object, stack) {
    console.log(value);
    if (!value) {
        return value;
    }

    const dateHandler = date => {
        const millis = date.getTime();
        const nanos = millis % 1000;
        const seconds = (millis - nanos) / 1000;
        return {seconds, nanos};
    };

    const objHandler = obj => {
        const doc = {};
        _.each(obj, (v, k) => {
            doc[k] = _.cloneDeepWith(v, cb);
        });
        return doc;
    };

    if (value instanceof mongoose.Model) {
        return _.cloneDeepWith(value.toObject(), cb);
    }

    if (key === '_id') {
        console.log();
    }

    if (value instanceof mongoose.Types.ObjectId) {
        return value.toString();
    }

    if (value instanceof Date) {
        return dateHandler(value);
    }

    if (Array.isArray(value)) {
        return value.map(el => _.cloneDeepWith(el, cb));
    }

    if (typeof value === 'object') {
        return objHandler(value);
    }

    return value;
};

async function list (call) {
    const orders = await db.Order.find()
        .populate('user')
        .populate('products');
    console.log('------------------------------------------------------');

    // const docs = cloneDeepWith(orders, cb);
    console.log(JSON.stringify(orders, null, 2));
    return {orders};
}

async function main() {
    const server = await Server.addServer({
        bindPath: `0.0.0.0:${PORT}`,
        services: [
            {filename: 'gnat/grpc/order.proto'},
        ],
        methods: {
            'gnat.grpc.Order': {list},
        }
    });
    server.start();
}

(async () => {
    await initData();
    await main();
})().catch(e => console.error(e.stack));
