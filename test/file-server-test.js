/**
 * Created by leaf4monkey on 04/09/2018
 */

const server = require('./file-server');
const request = require('supertest');
const {expect} = require('chai');

describe.skip('file-server', () => {
    describe('/example.txt', () => {
        it('should got file content', done => {
            const expected = 'Hello\nWorld!';

            request(server)
                .get('/example.txt')
                .expect(200)
                .expect('Content-Type', 'text/plain; charset=UTF-8')
                .end((err, res) => {
                    expect(res.text, expected);
                    done();
                });
        });
    });
});
