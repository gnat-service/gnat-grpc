/**
 * Created by leaf4monkey on 04/10/2018
 */
const {Client, config: ggConf} = require('../../');
const config = require('./config');
const PATH = require('path');
const grpc = require('grpc');
const protobufjs = require('protobufjs');

const root = PATH.join(__dirname, '.proto');

ggConf({
    grpc,
    protobufjs,
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
        filename: 'gnat/files/helloworld.proto',
    });

    const service2 = await client.checkout({
        fileLocation: 'local',
        bindPath: `localhost:${PORT}`,
        protoPath: protoPath2,
    });

    const meta = new grpc.Metadata();
    meta.set('key', 'value');
    const ret = await service.sayHello({m: {reply: {message: '11'}}, name: 'World', gender: 'FEMALE'}, meta);
    const ret2 = await service2.sayHello({name: null});
    const ret3 = await service.sayHello({m: {reply: {message: '11'}}, name: 'World', gender: 'FEMALE'}, meta, {});

    console.log('Greeting:', ret);
    console.log('Greeting again:', ret2);
    console.log('Greeting again:', ret3);

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
