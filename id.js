define('kademlia/id', function() {
    'use strict';

    function random(sizeInBytes) {
        var buf = new Uint8Array(sizeInBytes || 20);
        crypto.getRandomValues(buf);
        return buf;
    }

    function dist(a, b) {
        return xor(a, b);
    }

    function xor(a, b) {
        if (a.byteLength !== b.byteLength) {
            throw "Cannot xor values with different bit lengths.";
        }
        var result = new Uint8Array(a.length);
        for (var i = 0; i < a.length; i += 1) {
            result[i] = a[i] ^ b[i];
        }
        return result;
    }

    /* Returns position of the most significant bit with a 1 value. */
    function sigBit(a) {
        var l, len = a.length;
        for (var i = 0; i <= len; i += 1) {
            l = Math.round(log(a[i]));
            if (l >= 0) {
                return ((len - (i + 1)) * 8) + l;
            }
        }
        return -Infinity;
    }

    /* log base 2 */
    function log(x) {
        return Math.log(x) / Math.LN2;
    }

    function compare(a, b) {
        if (a.byteLength !== b.byteLength) {
            throw "Cannot compare values with different bit lengths.";
        }
        for (var i = 0; i <= a.length; i += 1) {
            if (a[i] !== b[i]) {
                return a[i] - b[i];
            }
        }
        return 0;
    }

    function sum(a, b) {
        if (a.byteLength !== b.byteLength) {
            throw "Cannot sum values with different bit lengths.";
        }
        var result = new Uint8Array(a.length)
          , carry  = 0
          , inter  = 0;
        for (var i = a.length - 1; i >= 0; i -= 1) {
            inter = a[i] + b[i] + carry;
            carry = Math.floor(inter / 256);
            result[i] = inter % 256;
        }
        if (carry !== 0) {
            throw "overflow in sum";
        }
        return result;
    }

    return {
        makeId:  makeId,
        dist:    dist,
        xor:     xor,
        compare: compare,
        sum:     sum
    };
});
