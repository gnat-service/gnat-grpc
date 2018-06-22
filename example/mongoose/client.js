/**
 * Created by leaf4monkey on 04/17/2018
 */
const grpc = require('grpc');
const gnatGrpc = require('../../');
const protobufjs = require('protobufjs');
const PATH = require('path');

const root = PATH.join(__dirname, '.proto');
const OrderProto = PATH.join(__dirname, '.proto/gnat/grpc/order.proto');
const PORT = 50051;

gnatGrpc.config({
    grpc,
    protobufjs,
    root
});

const {Client} = gnatGrpc;

async function main() {
    const client = await Client.checkoutServices({
        bindPath: `localhost:${PORT}`,
        services: [
            {filename: 'gnat/grpc/order.proto'},
        ]
    });
    const OrderService = client.getService('gnat.grpc.Order');
    const list = await OrderService.list({});
    // console.log(JSON.stringify(list, null, 2))
    const [order] = list.orders;
    console.log(order._id);
    console.log(typeof order._id);
}

process.on('unhandledRejection', e => console.error(e.stack || e));

main();
