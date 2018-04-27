/**
 * Created by leaf4monkey on 04/27/2018
 */

const check = require('../utils/check');
const {random} = require('faker');
const chai = require('chai');

const {expect} = chai;

describe('utils.check', () => {
    describe('.strOpt()', () => {
        const o = {
            string: '',
            number: 0,
            object: {},
            function: () => {},
            undefined: undefined,
            null: null,
            boolean: false
        };
        const types = Object.keys(o);
        const requiredTypes = types.slice(0).splice(types.indexOf('undefined'), 1);
        let requiredType;
        const baseTypes = ['undefined', 'object', 'number', 'string', 'boolean', 'function'];

        before(() => {
            requiredType = random.arrayElement(requiredTypes);
        });
        context('when type is correct', () => {
            it('should pass', () => {
                check.strOpt(o, 'string', 'string');
            });
        });
        context('when field is undefined type and not required', () => {
            it('should pass', () => {
                check.strOpt(o, 'undefined', false)
            });
        });
        context('when field is undefined type but required', () => {
            it('should pass', () =>
                expect(() => check.strOpt(o, 'undefined'))
                    .to.throw(TypeError, 'Expect `opts.undefined` to be "string" type, got undefined')
            );
        });
        context('when type is not correct', () => {
            let expectedType;
            before(() => {
                const idx = baseTypes.indexOf(requiredType);
                let types = baseTypes.slice(0);
                if (idx >= 0) {
                    types.splice(idx, 1);
                }
                expectedType = random.arrayElement(types);
            });
            it('should fail', () =>
                expect(() => check.strOpt(o, requiredType, expectedType))
                    .to.throw(
                    TypeError,
                    `Expect \`opts.${requiredType}\` to be "string" type, got ${typeof o[requiredType]}`
                )
            );
        });
    });

    describe('serviceConflict', () => {
        it('should pass when service not exists', () => {
            check.serviceConflict({}, 'a');
        });
        it('should fail when service exists', () =>
            expect(() => check.serviceConflict({a: 1}, 'a'))
                .to.throw('Service `a` already exists.')
        );
    });
});