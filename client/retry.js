const grpc = require('grpc');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = class RetryStrategy {
    constructor({grpc, maxRetries = 3, intervalMs = 0, shouldRetryWhen} = {}) {
        this.maxRetries = maxRetries;
        this.intervalMs = intervalMs;
        this.shouldRetryWhen = shouldRetryWhen || this._onStatusStrategy;
        this.StatusBuilder = grpc.StatusBuilder;
        this.ListenerBuilder = grpc.ListenerBuilder;
        this.RequesterBuilder = grpc.RequesterBuilder;
        this.InterceptingCall = grpc.InterceptingCall;
    }

    _onStatusStrategy(status) {
        return status.code !== grpc.status.OK;
    }

    getInterceptor() {
        const self = this;
        return function (options, nextCall) {
            let savedMetadata;
            let savedSendMessage;
            let savedReceiveMessage;
            let savedMessageNext;
            const requester = (new self.RequesterBuilder())
                .withStart(function (metadata, listener, next) {
                    savedMetadata = metadata;
                    const new_listener = (new self.ListenerBuilder())
                        .withOnReceiveMessage(function (message, next) {
                            savedReceiveMessage = message;
                            savedMessageNext = next;
                        })
                        .withOnReceiveStatus(function (status, next) {
                            let retries = 0;
                            let retry;

                            const execNext = (status, receivedMessage) => {
                                savedMessageNext(receivedMessage);
                                next(status);
                            };
                            const exec = (message, metadata) => {
                                const newCall = nextCall(options);
                                let receivedMessage;
                                newCall.start(metadata, {
                                    onReceiveMessage(message) {
                                        receivedMessage = message;
                                    },
                                    onReceiveStatus(status) {
                                        if (retries < self.maxRetries && self.shouldRetryWhen(status, retries)) {
                                            retry(message, metadata);
                                        } else {
                                            execNext(status, receivedMessage);
                                        }
                                    }
                                });
                                newCall.sendMessage(message);
                                newCall.halfClose();
                            };
                            retry = function (message, metadata) {
                                retries++;
                                if (self.intervalMs) {
                                    wait(self.intervalMs).then(() => exec(message, metadata));
                                } else {
                                    exec(message, metadata);
                                }
                            };

                            if (self.maxRetries > 0 && self.shouldRetryWhen(status, retries)) {
                                retry(savedSendMessage, savedMetadata);
                            } else {
                                execNext(status, savedReceiveMessage);
                            }
                        })
                        .build();
                    next(metadata, new_listener);
                })
                .withSendMessage(function (message, next) {
                    savedSendMessage = message;
                    next(message);
                })
                .build();
            return new self.InterceptingCall(nextCall(options), requester);
        };
    }
}
