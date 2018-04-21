/**
 * Created by leaf4monkey on 04/17/2018
 */

const mongoose = require('mongoose');
const escapeReg = require('escape-string-regexp');

const {Schema} = mongoose;
const {ObjectId: ObjectIdType} = Schema;
const {ObjectId} = mongoose.Types;

const AddressSchema = new Schema({
    phone: String,
    address: String,
    name: String
});

const ProductSchema = new Schema(
    {
        name: {type: String, required: true},
    },
    {
        timestamps: true
    }
);

const UserSchema = new Schema(
    {
        nickname: {type: String},
        addressList: [AddressSchema],
        gender: {type: String, enum: ['MALE', 'FEMALE']},
        position: {type: String, enum: ['ADMIN', 'DEVELOPER', 'REPORTER']}
    }
);

const OrderSchema = new Schema(
    {
        user: {type: ObjectIdType, ref: 'User'},
        products: [{type: ObjectIdType, ref: 'Product'}],
        amount: Number
    },
    {
        timestamps: true
    }
);

const ProductModel = mongoose.model('Product', ProductSchema);
const UserModel = mongoose.model('User', UserSchema);
const OrderModel = mongoose.model('Order', OrderSchema);

exports.Product = ProductModel;
exports.User = UserModel;
exports.Order = OrderModel;
