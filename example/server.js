/**
 * Created by leaf4monkey on 04/10/2018
 */
const {Server, config: ggConf} = require('../');
const config = require('./config');
const app = require('./.proto/fireball/files');
const PATH = require('path');
const grpc = require('grpc');
const protobufjs = require('protobufjs');

const root = PATH.join(__dirname, '.proto');

ggConf({
    grpc: require('grpc'),
    protobufjs: require('protobufjs'),
    root,
});
const {PORT, APP_PORT} = config;

const protoPath = PATH.resolve(root, config.protoPath);
const protoPath2 = PATH.resolve(root, config.protoPath2);
const protoUrl = `http://localhost:${APP_PORT}/helloworld.proto`;

const sayHello = async function ({name, gender}) {
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
    const err = new Error(`使用了错误的名字 "${name}"，再写错小心 neng shi 你`);
    console.log(err.stack);
    err.code = 20000;
    throw err;
};

app.listen(APP_PORT, async () => {
    const server = new Server({
        bindPath: `0.0.0.0:${PORT}`
    });
    await Promise.all([
        server.registerService(
            {
                fileLocation: 'local',
                protoPath: protoPath,
            },
            {sayHello, throwAnErr}
        ),
        server.registerService(
            {
                fileLocation: 'local',
                protoPath: protoPath2,
            },
            {sayHello}
        ),
    ]).catch(e => console.error(e.stack));
    server.start();
    console.log(`Server listening on ${PORT}...`);
});
