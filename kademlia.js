/*globals crypto */
/*jshint laxcomma:true */

function dist(a, b) {
    return xor(a, b);
}

function makeId(size) {
    size = size || 128;
    var words = Math.ceil(size / 32)
      , buf   = new Int32Array(words);
    crypto.getRandomValues(buf);
    return buf;
}

function xor(a, b) {
    if (a.byteLength !== b.byteLength) {
        throw "Cannot xor values with different bit lengths.";
    }
    var result = new Int32Array(a.length);
    for (var i = 0; i < a.length; i += 1) {
        result[i] = a[i] ^ b[i];
    }
    return result;
}
