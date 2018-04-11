/**
 * Created by leaf4monkey on 04/10/2018
 */
const Server = require('../server');
const config = require('./config');
const ggConf = require('../config');
const app = require('./files');
const PATH = require('path');

ggConf._config({
    grpc: require('grpc'),
    protobufjs: require('protobufjs')
});

const {grpc} = ggConf;
const {PORT, APP_PORT} = config;
const protoPath = PATH.resolve(__dirname, config.protoPath);
const protoPath2 = PATH.resolve(__dirname, config.protoPath2);
const protoUrl = `http://localhost:${APP_PORT}/helloworld.proto`;

const sayHello = async function ({name}) {
    return {message: `Hello ${name}`};
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
                fileLocation: 'remote',
                protoPath: protoUrl,
                pkgName: 'helloworld',
                service: 'Greeter'
            },
            {sayHello, throwAnErr}
        ),
        server.registerService(
            {
                fileLocation: 'local',
                protoPath: protoPath2,
                pkgName: 'helloworld2',
                service: 'Greeter2'
            },
            {sayHello}
        ),
    ]);
    server.start();
});
