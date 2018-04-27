/**
 * Created by leaf4monkey on 04/27/2018
 */

const sinon = require('sinon');
const request = require('request');
const {expect} = require('chai');
const utils = require('../utils');

describe('request', () => {
    let stub;
    context('on request success', () => {
        beforeEach(() => {
            stub = sinon.stub(request, 'get').yields(null, {}, 'Hello World');
        });
        afterEach(() => {
            stub.restore();
        });
        it('should await response', async () => {
            const r = await utils._request.get('', {});
            expect(r).to.equal('Hello World');
        });
    });
    context('on request error', () => {
        beforeEach(() => {
            stub = sinon.stub(request, 'get').yields(new Error('error-occurred'), {});
        });
        afterEach(() => {
            stub.restore();
        });
        it('should reject on error', async () => {
            let e;
            try {
                await utils._request.get('', {});
            } catch (err) {
                e = err;
            }
            expect(e).to.have.property('message').which.equal('error-occurred');
        });
    });
});
