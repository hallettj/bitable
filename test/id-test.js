/*globals require, module, test, equal, ok */

require(['kademlia/id'], function(Id) {
    'use strict';

    module('peer/id');

    test('distance from a value to itself is zero', 100, function() {
        quickcheck(1, function(a) {
            var zero = Id.zero(20);
            equal( Id.compare(Id.dist(a, a), zero), 0, 'distance from a value to itself is 0' );
        });
    });

    test('distance from a to b is equal to distance from b to a', 100, function() {
        quickcheck(2, function(a, b) {
            equal( Id.compare(Id.dist(a, b), Id.dist(b, a)), 0, 'distance is symmetric' );
        });
    });

    test('distance from a to b is less than or equal to distance from a to c to b', 100, function() {
        quickcheck(3, function(a, b, c) {
            var oneSide, twoSides;
            oneSide = Id.dist(a, b);
            try {
                twoSides = Id.sum(Id.dist(a, c), Id.dist(c, b));
                ok(
                    Id.compare(Id.dist(a, b), Id.sum(Id.dist(a, c), Id.dist(c, b))) <= 0,
                    'triangle inequality holds'
                );
            }
            catch(_) {
                // skip cases where sum overflows
                return false;
            }
        });
    });

    test('remains stable after encoding and decoding', 100, function() {
        quickcheck(1, function(a) {
            var zero = Id.zero(20);
            equal( Id.compare( Id.xor(a, zero), a ), 0 );
        });
    });

    function quickcheck(numIds, fn) {
        var n = 100, ids, i, j;
        for (i = 0; i < n; i += 1) {
            ids = [];
            for (j = 0; j < numIds; j += 1) {
                ids.push(Id.random(20));
            }
            if (false === fn.apply(null, ids)) {
                i -= 1;
            }
        }
    }
});
