const {Types: {ObjectId}} = require('mongoose');

module.exports = {
    fullName: '.gnat.mongoose.ObjectId',
    transforms: {
        fromObject (o) {
            if (!o) {
                return o;
            }

            if (typeof o === 'string') {
                return {id: o};
            }

            return {id: o.toString()};
        },
        toObject (m) {
            if (!m) {
                return m;
            }
            if (typeof m === 'string') {
                return m;
            }
            return m.id;
        }
    }
};
