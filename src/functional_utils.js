import { assign } from 'lodash';

export {
    data,
    match,
    modify,
    modifyMany
};

function constructor(type, name, fields) {
    return function c(...args) {
        var v = {};
        fields.forEach((field, i) => {
            v[field] = args[i];
        });
        v._args       = Object.freeze(args);
        v.constructor = c;
        v.type        = type;
        return Object.freeze(v);
    };
}

function data(constructors) {
    var res = {};
    Object.freeze(constructors);
    Object.keys(constructors).forEach(k => {
        res[k] = constructor(res, k, constructors[k]);
    });
    return Object.freeze(res);
}

function match(type, cases) {
    checkCases(type, cases);

    return function matcher(v) {
        var caseKeys = Object.keys(cases);
        var len = caseKeys.length;
        var k;
        for (var i = 0; i < len; i += 1) {
            k = caseKeys[i];
            if (v.constructor === type[k]) {
                return cases[k](...v._args);
            }
        }
        if (cases.hasOwnProperty('_') && typeof cases._ === 'function') {
            return cases._(...v._args);
        }
    };
}

function checkCases(type, cases) {
    var typeKeys = Object.keys(type);
    var wildcard = cases.hasOwnProperty('_') && typeof cases._ === 'function';

    var exhaustive = wildcard || typeKeys.reduce(
        (dec, k) => dec && cases.hasOwnProperty(k) && typeof cases[k] === 'function',
        true
    );

    if (!exhaustive && typeof console != 'undefined' && console.warn) {
        console.warn("Non-exhaustive match", type, cases);
    }

    return exhaustive;
}

function modify(table, key, val) {
    var updated = assign({}, table);
    updated[key] = val;
    return Object.freeze(updated);
}

function modifyMany(table, changes) {
    var fields = Object.keys(changes);
    return fields.reduce(
        (t, field) => modify(t, field, changes[field]),
        table
    );
}
