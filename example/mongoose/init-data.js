/**
 * Created by leaf4monkey on 04/17/2018
 */

const data = require('./data.json');
const _ = require('lodash');
const db = require('./db');

module.exports = async () => {
    await Promise.all([
        db.Order.remove({}),
        db.Product.remove({}),
        db.User.remove({}),
    ]);
    const results = {};
    await Promise.all(
        _.map(data, async (docs, name) => {
            results[name] = await db[name].insertMany(docs);
        })
    );
    const productIds = results.Product.map(({_id}) => _id);
    await db.Order.insertMany([
        {user: results.User[0], products: [productIds[0]]},
        {user: results.User[1], products: productIds.slice(1, 3)},
        {user: results.User[2], products: productIds.slice(3)}
    ]);
    console.log(
        JSON.stringify(
            await db.Order.find()
                .populate('user')
                .populate('products'),
            null,
            2
        )
    );
    console.log('Initialized done!');
};
