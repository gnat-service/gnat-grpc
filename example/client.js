/**
 * Created by leaf4monkey on 04/10/2018
 */
const {Client, config: ggConf} = require('../');
const config = require('./config');
const PATH = require('path');

ggConf({
    grpc: require('grpc'),
    protobufjs: require('protobufjs'),
    root: PATH.join(__dirname, 'files'),
});
const {PORT, APP_PORT} = config;

const protoPath = PATH.resolve(__dirname, config.protoPath);
const protoPath2 = PATH.resolve(__dirname, config.protoPath2);
const protoUrl = `http://localhost:${APP_PORT}/helloworld.proto`;

(async () => {
    const client = new Client();
    const service = await client.checkout({
        fileLocation: 'local',
        bindPath: `localhost:${PORT}`,
        filename: 'helloworld.proto',
    });

    const service2 = await client.checkout({
        fileLocation: 'local',
        bindPath: `localhost:${PORT}`,
        protoPath: protoPath2,
        pkgName: 'helloworld',
        service: 'Greeter2'
    });

    const ret = await service.sayHello({name: 'World', gender: 'FEMALE'});
    const ret2 = await service2.sayHello({name: 'World'});

    console.log('Greeting:', ret);
    console.log('Greeting again:', ret2);

    try {
        await service.throwAnErr({name: 'WrongName'});
    } catch (e) {
        console.error('Caught an error:', e);
    }
})().catch(e => console.error(e.stack));
