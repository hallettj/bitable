define('bitstar/functional_utils', [
    'lodash'
], function(_) {
    'use strict';

    function constructor(name, fn) {
        var c = function() {
            var v = fn.apply(null, arguments);
            v._args = Object.freeze(Array.prototype.slice.call(arguments));
            _.assign(v, typeLabel);
            return Object.freeze(v);
        };
        var typeLabel = Object.freeze({
            constructor: c,
            type: c
        });
        return c;
    }

    function data(constructors) {
        var res = {};
        Object.keys(constructors).forEach(function(k) {
            res[k] = constructor(k, constructors[k]);
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
        var updated = {};
        updated[key] = val;
        _.assign(updated, table);
        return Object.freeze(updated);
    }

    return {
        data:   data,
        match:  match,
        modify: modify
    };
});

