/**
 * Created by leaf4monkey on 04/10/2018
 */
const Client = require('../client');
const config = require('./config');
const ggConf = require('../config');
const PATH = require('path');

ggConf._config({
    grpc: require('grpc'),
    protobufjs: require('protobufjs')
});
const {PORT, APP_PORT} = config;

const protoPath = PATH.resolve(__dirname, config.protoPath);
const protoPath2 = PATH.resolve(__dirname, config.protoPath2);
const protoUrl = `http://localhost:${APP_PORT}/helloworld.proto`;

(async () => {
    const client = new Client();
    const service = await client.checkout({
        fileLocation: 'remote',
        bindPath: `localhost:${PORT}`,
        protoPath: protoUrl,
        pkgName: 'helloworld',
        service: 'Greeter'
    });

    const service2 = await client.checkout({
        fileLocation: 'local',
        bindPath: `localhost:${PORT}`,
        protoPath: protoPath2,
        pkgName: 'helloworld2',
        service: 'Greeter2'
    });

    const ret = await service.sayHello({name: 'World'});
    const ret2 = await service2.sayHello({name: 'World'});

    console.log('Greeting:', ret);
    console.log('Greeting again:', ret2.message);

    try {
        await service.throwAnErr({name: 'WrongName'});
    } catch (e) {
        console.error('Caught an error:', e);
    }
})();
