/**
 * Created by leaf4monkey on 04/10/2018
 */

const optType = (o, f, t, r = true) => {
    const fType = typeof o[f];
    if (fType === 'undefined' && !r) {
        return;
    }

    if (fType !== t) {
        throw new TypeError(`Expect \`opts.${f}\` to be "${t}" type, got ${fType}`);
    }
};

const strOpt = (o, f, r) => optType(o, f, 'string', r);

const serviceConflict = (coll, key) => {
    if (coll[key]) {
        throw new Error(`Service \`${key}\` already exists.`);
    }
};

module.exports = {
    strOpt,
    serviceConflict,
};
