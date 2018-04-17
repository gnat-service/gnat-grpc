/**
 * Created by leaf4monkey on 04/10/2018
 */
const {Client, config: ggConf} = require('../');
const config = require('./config');
const PATH = require('path');

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

(async () => {
    const client = new Client();
    const service = await client.checkout({
        fileLocation: 'local',
        bindPath: `localhost:${PORT}`,
        filename: 'fireball/files/helloworld.proto',
    });

    const service2 = await client.checkout({
        fileLocation: 'local',
        bindPath: `localhost:${PORT}`,
        protoPath: protoPath2,
    });

    const ret = await service.sayHello({name: 'World', gender: 'FEMALE'});
    const ret2 = await service2.sayHello({name: 'World'});

    console.log('Greeting:', ret);
    console.log('Greeting again:', ret2);

    try {
        await service.throwAnErr({name: 'WrongName'});
    } catch (e) {
        for (let i in e) console.log(i);
        console.log('stack:', e.stack);
        console.log('message:', e.message);
        console.log(e.toString());
        console.error(e);
    }
})().catch(e => console.error(e.stack));
