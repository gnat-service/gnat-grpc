/**
 * Created by leaf4monkey on 04/20/2018
 */
const {Server, Client, config: ggConf} = require('../');
const PATH = require('path');
const camelCase = require('lodash.camelcase');
const capitalize = require('lodash.capitalize');
const times = require('lodash.times');
const isEmpty = require('lodash.isempty');
const grpc = require('grpc');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const {random, date: randomDate} = require('faker');

chai.use(chaiAsPromised);
chai.should();
const {expect} = chai;
const getRandomNumByRange = (min, max) => random.number({min, max});

const getters = {
    getInt: opt => random.number(opt),
    getFloat: opt => random.number(opt), // 无法正确传递小数，故无法测试
    getString: () => random.words(),
    getBool: () => random.boolean(),
    getDate: ({years, refDate, type = random.arrayElement(['past', 'future'])} = {}) =>
        randomDate[type](years, refDate),
};

const emptyMap = {
    float: 0,
    int: 0,
    bool: false,
    string: '',
    Date: new Date(0)
};

const typeMap = {
    float: ['DoubleValue', 'FloatValue'],
    int: ['Int64Value', 'UInt64Value', 'Int32Value', 'UInt32Value'],
    bool: ['BoolValue'],
    string: ['StringValue'],
    Date: ['Timestamp']
};
const baseTypes = Object.keys(typeMap);
const wrappedTypes = [];
const wrappedMap = {};
baseTypes.forEach(type => {
    typeMap[type].forEach(wrapped => {
        wrappedMap[wrapped] = type;
        wrappedTypes.push(wrapped);
    });
});

const getRandom = (opts = {}) => {
    const obj = {type: 'random'};
    wrappedTypes.forEach(wrapped => {
        const type = wrappedMap[wrapped];
        const field = camelCase(wrapped);
        const getVal = () => getters[`get${capitalize(type)}`](opts[type]);
        const getLen = () => opts.hasOwnProperty('length') ? opts.length : getRandomNumByRange(2, 4);
        obj[field] = getVal();
        obj[`${field}Arr`] = times(getLen(), getVal);
        obj[`${field}Map`] = {};
        const map = obj[`${field}Map`];
        const setMap = () => {
            map[random.word()] = getVal();
        };
        times(getLen(), setMap);
    });
    return obj;
};
const getObjMethods = {
    random: getRandom,

    null: () => {
        const obj = {type: 'null'};
        wrappedTypes.forEach(wrapped => {
            const field = camelCase(wrapped);
            obj[field] = null;
            obj[`${field}Arr`] = null;
            obj[`${field}Map`] = null;
        });
        return obj;
    },

    undefined: () => {
        const obj = {type: 'undefined'};
        wrappedTypes.forEach(wrapped => {
            const field = camelCase(wrapped);
            obj[field] = undefined;
            obj[`${field}Arr`] = undefined;
            obj[`${field}Map`] = undefined;
        });
        return obj;
    },

    typedEmpty: () => {
        const obj = {type: 'typedEmpty'};
        wrappedTypes.forEach(wrapped => {
            const type = wrappedMap[wrapped];
            const key = camelCase(wrapped);
            obj[key] = emptyMap[type];
            obj[`${key}Arr`] = [];
            obj[`${key}Map`] = {};
        });
        return obj;
    },

    mixing () {
        /* istanbul ignore next */
        const obj = {type: 'mixing'};

        /* istanbul ignore next */
        wrappedTypes.forEach(wrapped => {
            const type = wrappedMap[wrapped];
            const field = camelCase(wrapped);
            if (/timestamp/i.test(field)) {
                return;
            }
            const getVal = () => getters[`get${capitalize(type)}`]();
            const getRandomVal = () => random.arrayElement([null, getVal()]);
            obj[field] = getRandomVal();
            obj[`${field}Arr`] = [null, undefined, getVal()];
            obj[`${field}Map`] = {
                [random.word()]: getVal(),
                null: null,
                undefined: undefined,
            };
        });

        /* istanbul ignore next */
        return obj;
    },

    mixingMap () {
        /* istanbul ignore next */
        const obj = {type: 'mixingMap'};

        /* istanbul ignore next */
        wrappedTypes.forEach(wrapped => {
            const type = wrappedMap[wrapped];
            const field = camelCase(wrapped);
            const getVal = () => getters[`get${capitalize(type)}`]();
            const getRandomVal = () => random.arrayElement([null, getVal()]);
            obj[field] = getRandomVal();
            obj[`${field}Map`] = {
                [random.word()]: getVal(),
                null: null,
                undefined: undefined,
            };
        });

        /* istanbul ignore next */
        return obj;
    },

    mixingArr () {
        /* istanbul ignore next */
        const obj = {type: 'mixingArr'};

        /* istanbul ignore next */
        wrappedTypes.forEach(wrapped => {
            const type = wrappedMap[wrapped];
            const field = camelCase(wrapped);
            const getVal = () => getters[`get${capitalize(type)}`]();
            const getRandomVal = () => random.arrayElement([null, getVal()]);
            obj[field] = getRandomVal();
            obj[`${field}Arr`] = [null, undefined, getVal()];
        });

        /* istanbul ignore next */
        return obj;
    }
};

const root = PATH.join(__dirname, 'file-server/files');

ggConf({
    grpc,
    protoLoader: require('@grpc/proto-loader'),
    root,
});
const PORT = 50021;

describe('Base types wrapper', () => {
    let server;
    let client;
    let service;
    let i = 0;
    const resultsContainer = {};
    const getKey = dataType => `${i}-${dataType}`;

    const baseAssert = (dataType, data) => {
        const expected = resultsContainer[getKey(dataType)];
        const o1 = {};
        Object.keys(expected).sort().forEach(f => o1[f] = expected[f]);
        const o2 = {};
        Object.keys(data).sort().forEach(f => o2[f] = data[f]);
        data.type === 'typedEmpty' && Object.keys(expected).forEach(key => {
            const val = expected[key];
        });
        expect(data).to.deep.equal(expected);
    };
    const nullAssert = (dataType, data) => {
        wrappedTypes.forEach(wrapped => {
            /* istanbul ignore next */
            if (/Arr$/.test(wrapped)) {
                expect(data).to.have.property(camelCase(wrapped)).to.be.an('Array').with.length(0);
            } else if (/Map$/.test(wrapped)) {
                expect(data).to.have.property(camelCase(wrapped)).to.deep.equal({});
            } else {
                expect(data).to.have.property(camelCase(wrapped)).to.equal(null);
            }
        });
    };
    const asserts = {
        random (dataType, data) {
            baseAssert(dataType, data);

            ['float', 'int'].forEach(type =>
                typeMap[type].forEach(wrapped =>
                    expect(data).to.have.property(camelCase(wrapped)).to.be.a('number')
                )
            );
            expect(data).to.have.property('boolValue').to.be.a('boolean');
            expect(data).to.have.property('stringValue').to.be.a('string');
        },
        null: nullAssert,
        undefined: nullAssert,
        typedEmpty (dataType, data) {
            baseAssert(dataType, data);

            ['float', 'int'].forEach(type =>
                typeMap[type].forEach(wrapped =>
                    expect(data).to.have.property(camelCase(wrapped)).to.equal(0)
                )
            );
            expect(data).to.have.property('boolValue').to.equal(false);
            expect(data).to.have.property('stringValue').to.equal('');
        },
        mixing: baseAssert,
        mixingArr: baseAssert,
        mixingMap: baseAssert
    };

    const addReqData = data => {
        resultsContainer[getKey('req')] = data;
    };
    const addResData = data => {
        resultsContainer[getKey('res')] = data;
    };

    const changeData = (data) => {
        const {type} = data;
        asserts[type]('req', data);
        const res = getObjMethods[type]();
        addResData(res);
        return res;
    };

    const simpleArgReqObj = {};
    const simpleArgReqMethods = [
        'doubleValue',
        'floatValue',
        'int64Value',
        'uInt64Value',
        'int32Value',
        'uInt32Value',
        'boolValue',
        'stringValue',
    ];
    simpleArgReqMethods.forEach(key => {
        simpleArgReqObj[key] = arg => {
            expect(arg).not.to.be.an('Object');
            return arg;
        }
    });

    simpleArgReqObj.timestamp = arg => {
        expect(arg).to.be.an.instanceOf(Date);
        return arg;
    };

    const callChangeData = async type => {
        const req = getObjMethods[type]();
        addReqData(req);
        const data = await service.changeData(req);
        asserts[type]('res', data);
    };

    const simpleArgReqCaller = {};
    simpleArgReqMethods.forEach(method => {
        simpleArgReqCaller[method] = async arg => {
            const data = await service[method](arg);
            expect(data).to.equal(arg);
        }
    });
    simpleArgReqCaller.timestamp = async arg => {
        const data = await service.timestamp(arg);
        expect(data).to.deep.equal(arg);
    };

    before(() => {
        server = new Server({bindPath: `0.0.0.0:${PORT}`});
        client = new Client();
    });
    before(() =>
        server.registerService(
            {filename: 'wrapper_test.proto'},
            Object.assign({changeData}, simpleArgReqObj)
        )
    );
    before(() => server.start());
    before(() =>
        client.checkout({
            bindPath: `localhost:${PORT}`,
            filename: 'wrapper_test.proto'
        })
    );
    before(() => {
        service = client.getService('gnat.helloworld.WrapperTest');
    });
    afterEach(() => {
        i++;
    });
    after('client shutdown', async () => client.close());
    after('server shutdown', async () => server.tryShutdown());
    after(() => {
        i = 0;
    });

    it('random values', () => callChangeData('random'));
    it('null values', () => callChangeData('null'));
    it('undefined values', () => callChangeData('undefined'));
    it('typedEmpty values', () => callChangeData('typedEmpty'));

    context('simple type arg request with true value', () => {
        it('double value', () => simpleArgReqCaller.doubleValue(3.1415926));
        it('float value', () => simpleArgReqCaller.floatValue(3.0));
        it('int64 value', () => simpleArgReqCaller.int64Value(3));
        it('uint64 value', () => simpleArgReqCaller.uInt64Value(3));
        it('int32 value', () => simpleArgReqCaller.int32Value(3));
        it('uint32 value', () => simpleArgReqCaller.uInt32Value(3));
        it('bool value', () => simpleArgReqCaller.boolValue(true));
        it('string value', () => simpleArgReqCaller.stringValue('string'));
        it('timestamp value', () => simpleArgReqCaller.timestamp(new Date()));
    });
    context('simple type arg request with false value', () => {
        it('double value', () => simpleArgReqCaller.doubleValue(0));
        it('float value', () => simpleArgReqCaller.floatValue(0));
        it('int64 value', () => simpleArgReqCaller.int64Value(0));
        it('uint64 value', () => simpleArgReqCaller.uInt64Value(0));
        it('int32 value', () => simpleArgReqCaller.int32Value(0));
        it('uint32 value', () => simpleArgReqCaller.uInt32Value(0));
        it('bool value', () => simpleArgReqCaller.boolValue(false));
        it('string value', () => simpleArgReqCaller.stringValue(''));
        it('timestamp value', () => simpleArgReqCaller.timestamp(new Date(0)));
    });
    context('simple type arg request with null value', () => {
        const call = async (method, val) =>
            () => simpleArgReqCaller[method](val).should.be.rejected;
        it('double value', () => call('doubleValue', null));
        it('float value', () => call('floatValue', null));
        it('int64 value', () => call('int64Value', null));
        it('uint64 value', () => call('uInt64Value', null));
        it('int32 value', () => call('int32Value', null));
        it('uint32 value', () => call('uInt32Value', null));
        it('bool value', () => call('boolValue', null));
        it('string value', () => call('stringValue', null));
        it('timestamp value', () => call('timestamp', null));
    });
    // it('mixing values', () => svcCall('mixing'));
    // it('mixing array values', () => svcCall('mixingArr'));
    // it('mixing map values', () => svcCall('mixingMap'));
});
