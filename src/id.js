define('kademlia/id', function(StringView) {
    'use strict';

    function random(sizeInBytes) {
        var buf = new Uint8Array(sizeInBytes || 20);
        crypto.getRandomValues(buf);
        return encode(buf);
    }

    function dist(a, b) {
        return xor(a, b);
    }

    function xor(a, b) {
        a = decode(a); b = decode(b);
        if (a.byteLength !== b.byteLength) {
            throw "Cannot xor values with different bit lengths.";
        }
        var result = new Uint8Array(a.length);
        for (var i = 0; i < a.length; i += 1) {
            result[i] = a[i] ^ b[i];
        }
        return encode(result);
    }

    /* Returns position of the most significant bit with a 1 value. */
    function sigBit(a) {
        a = decode(a);
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
        a = decode(a); b = decode(b);
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

    function equals(a, b) {
        return compare(a, b) === 0;
    }

    function sum(a, b) {
        a = decode(a); b = decode(b);
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
        return encode(result);
    }

    function zero(sizeInBytes) {
        var z = new Uint8Array(sizeInBytes);
        return encode(z);
    }

    function encode(view) {
        //return StringView.bytesToBase64(view);
        return bufToHex(view);
    }

    function decode(str) {
        //return StringView.base64ToBytes(str);
        return hexToBuf(str);
    }

    var chars = "0123456789abcdef";
    function bufToHex(buf) {
        var out = [], byte;
        for (var i = 0; i < buf.length; i += 1) {
            byte = buf[i];
            out.push(chars[Math.floor(byte / 16)]);
            out.push(chars[byte % 16]);
        }
        return out.join('');
    }

    function hexToBuf(str) {
        var buf = new Uint8Array(str.length / 2), j;
        for (var i = 0; i < buf.length; i += 1) {
            j = i * 2;
            buf[i] = (chars.indexOf(str[j]) * 16) + chars.indexOf(str[j+1]);
        }
        return buf;
    }

    return {
        random:  random,
        dist:    dist,
        xor:     xor,
        compare: compare,
        equals:  equals,
        sum:     sum,
        sigBit:  sigBit,
        zero:    zero
    };
});
