/**
 * Created by leaf4monkey on 04/10/2018
 */
const {Server, config: ggConf} = require('../');
const config = require('./config');
const app = require('./fireball/files');
const PATH = require('path');
const grpc = require('grpc');
const protobufjs = require('protobufjs');

ggConf({grpc, protobufjs});

const {PORT, APP_PORT} = config;
const protoPath = PATH.resolve(__dirname, config.protoPath);
const protoPath2 = PATH.resolve(__dirname, config.protoPath2);
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
    const err = new Error(`name "${name}" is not correct.`);
    err.code = grpc.status.PERMISSION_DENIED;
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
