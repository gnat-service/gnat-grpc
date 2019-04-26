# Gnat-Grpc

<a href="https://snyk.io/test/github/gnat-service/gnat-grpc"><img src="https://snyk.io/test/github/gnat-service/gnat-grpc/badge.svg" alt="Known Vulnerabilities" data-canonical-src="https://snyk.io/test/github/gnat-service/gnat-grpc" style="max-width:100%;"></a>

对 [grpc](https://www.npmjs.com/package/grpc) 的封装，简化 unary calls，目前尚不支持 streaming calls。

## Installation

```js
npm install grpc gnat-grpc
```

## Usage

helloworld.proto: 使用官方示例中的 helloworld.proto

public-conf.js:

```js
const gnatGrpc = require('../../');
const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');

// 仅能调用一次
gnatGrpc.config({
  grpc,
  protoLoader,
  // cwd, // 默认使用 `process.cwd()`
  // protoDir, // 默认为 `.proto`，即 `<cwd>/.proto`
  // defaultLoaderOpts: { // `protoLoader.load()` 的 load options，以下为默认配置项
  //   keepCase: true,
  //   enums: String,
  //   defaults: true,
  //   oneofs: true
  // },
  // escapeErrorAnyway: false, // 是否强制在 server 端 escape error message，在 client 端 unescape error message，以便支持中文消息。设置为 false 时则根据 grpc 版本决定是否需要处理
});
```

server.js:

```js
require('./public-conf');
const {Server} = require('gnat-grpc');

const sayHello = async (request, metadata, {setTrailer, setFlags}, call) => {
  return {message: 'Hello ' + args.name};
};

(async () => {
  const PORT = 50051;
  const server = new Server({
    bindPath: `0.0.0.0:${PORT}`
  });
  await server.registerService(
    {filename: 'path/to/helloworld.proto'},
    {sayHello}
  );
  server.start();
})();
```

client.js:

```js
require('./public-conf');
const {Client} = require('gnat-grpc');

(async () => {
  const PORT = 50051;
  const service = await client.checkout({
    fileLocation: 'local',
    bindPath: `localhost:${PORT}`,
    filename: 'path/to/helloworld.proto',
  });
  const ret = await service.sayHello({name: 'World'});
  console.log(ret); // {message: 'Hello World'}
})();
```

## To Do

// 支持 client retry
