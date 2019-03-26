/**
 * Created by leaf4monkey on 04/10/2018
 */
const {Client, config: ggConf} = require('../../');
const config = require('./config');
// const grpc = require('grpc');
const grpcClient = require('@grpc/grpc-js');

ggConf({
    // grpc,
    grpcClient,
    protoLoader: require('@grpc/proto-loader')
});
const {PORT} = config;

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
        filename: 'gnat/files/helloworld2.proto',
    });

    const meta = new grpcClient.Metadata();
    meta.set('key', 'value');
    const ret = await service.sayHello(
        {
            m: {reply: {message: '11'}},
            name: 'World',
            gender: 'FEMALE',
            strArr: ['1', '2'],
            strValArr: ['1', '2'],
            boolVal: false,
            time: '2018-05-12'
        },
        meta
    );
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

    setInterval(async () => {
        console.log('calling');
        try {
            const ret4 = await service.sayHello({m: {reply: {message: '11'}}, name: 'World', gender: 'FEMALE'}, meta, {});
            console.log(ret4);
        } catch (e) {
            console.error(e);
        }
    }, 10000);
})().catch(e => console.error(e.stack));
