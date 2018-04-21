/**
 * Created by leaf4monkey on 04/17/2018
 */

const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/grpc').catch(e => console.error(e));

module.exports = require('./model');
