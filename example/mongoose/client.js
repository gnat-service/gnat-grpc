/**
 * Created by leaf4monkey on 04/17/2018
 */
const gnatGrpc = require('../../');
const PATH = require('path');
const transformPatch = require('./patch');

const root = PATH.join(__dirname, '.proto');
const PORT = 50051;

gnatGrpc.config({
    root
});
transformPatch(gnatGrpc);

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
