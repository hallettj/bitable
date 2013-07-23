



// test

function assert(bool, msg) {
    if (!bool) {
        throw ("assertion failed" + (msg ? ': '+ msg : ''));
    }
}

function testIdentity(a) {
    var zero = new Uint8Array(a.length);
    assert( compare(dist(a, a), zero) === 0, 'distance from a value to itself is 0' );
}

function testSymmetry(a, b) {
    assert( compare(dist(a, b), dist(b, a)) === 0, 'distance is symmetric' );
}

function testTriangleInequality(a, b, c) {
    var oneSide, twoSides;
    oneSide = dist(a, b);
    try {
        twoSides = sum(dist(a, c), dist(c, b));
    }
    catch(_) {}
    if (twoSides) {
        assert( compare(dist(a, b), sum(dist(a, c), dist(c, b))) <= 0, 'triangle inequality holds' );
    }
}

function runTests(n) {
    n = n || 100;
    for (var i = 0; i < n; i += 1) {
        var a = makeId(), b = makeId(), c = makeId();
        testIdentity(a);
        testSymmetry(a, b);
        testTriangleInequality(a, b, c);
    }
}
