import bilby from 'bilby';
import {
    strictEquals,
    environment
} from 'bilby';
import {
    resolve
} from 'when/when';

var instance = bilby
    .method('flatMap', isPromise, (p, f) => p.then(f))
    .method('map',     isPromise, (p, f) => p.then(f))
    .method('ap',      isPromise,
        (a, b) => a.then(va => b.then(va))
    )
    .method('pure', strictEquals('promise'), (m, v) => resolve(v))
;

function isPromise(v) {
    return v && typeof v.then === 'function';
}

export default instance;

