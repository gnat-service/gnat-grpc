/**
 * Created by leaf4monkey on 04/10/2018
 */
const {Server, config: ggConf} = require('../../');
const config = require('./config');
const app = require('./.proto/gnat/files');
const grpc = require('grpc');
const protobufjs = require('protobufjs');

ggConf({
    grpc,
    protobufjs,
});
const {PORT, APP_PORT} = config;

const sayHello = async function (args, metadata) {
    const {name, gender} = args;
    console.log(JSON.stringify(args, null, 2));
    console.log({metadata});
    let title;
    switch (gender) {
        case 'MALE':
            title = 'Mr ';
            break;
        case 'FEMALE':
            title = 'Miss ';
            break;
        default:
            title = '';
            break;
    }
    return {message: `Hello ${title}${name}`};
};
const throwAnErr = ({name}) => {
    const err = new Error(`使用了错误的名字 "${name}"，写错了写错了写错了写错了写错了写错了写错了写错了`);
    console.log(err.stack);
    err.code = 20000;
    throw err;
};

app.listen(APP_PORT, async () => {
    const server = new Server({
        bindPath: `0.0.0.0:${PORT}`
    });
    await server.registerService(
        {filename: 'gnat/files/helloworld.proto'},
        {sayHello, throwAnErr}
    );
    await server.registerService(
        {filename: 'gnat/files/helloworld2.proto'},
        {sayHello}
    );
    server.start();
    console.log(`Server listening on ${PORT}...`);
});
