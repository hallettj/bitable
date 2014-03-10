define('bitstar/functional_utils', [
    'lodash'
], function(_) {
    'use strict';

    function constructor(type, name, fields) {
        return function c() {
            var args = Object.freeze(Array.prototype.slice.call(arguments));
            var v    = {};
            fields.forEach(function(field, i) {
                v[field] = args[i];
            });
            v._args       = args;
            v.constructor = c;
            v.type        = type;
            return Object.freeze(v);
        };
    }

    function data(constructors) {
        var res = {};
        Object.keys(constructors).forEach(function(k) {
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
                    return cases[k].apply(null, v._args);
                }
            }
            if (cases.hasOwnProperty('_') && typeof cases._ === 'function') {
                return cases._.apply(null, v._args);
            }
        };
    }

    function checkCases(type, cases) {
        var typeKeys = Object.keys(type);
        var wildcard = cases.hasOwnProperty('_') && typeof cases._ === 'function';

        var exhaustive = wildcard || typeKeys.reduce(function(dec, k) {
            return dec && cases.hasOwnProperty(k) && typeof cases[k] === 'function';
        });

        if (!exhaustive && typeof console != 'undefined' && console.warn) {
            console.warn("Non-exhaustive match", type, cases);
        }

        return exhaustive;
    }

    function modify(table, key, val) {
        var updated = _.assign({}, table);
        updated[key] = val;
        return Object.freeze(updated);
    }

    function modifyMany(table, changes) {
        var fields = Object.keys(changes);
        return fields.reduce(function(t, field) {
            return modify(t, field, changes[field]);
        }, table);
    }

    return {
        data:       data,
        match:      match,
        modify:     modify,
        modifyMany: modifyMany
    };
});

