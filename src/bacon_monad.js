import Bacon from 'Bacon';
import bilby from 'bilby';
import {
    constant
} from 'Bacon';
import {
    strictEquals,
    environment
} from 'bilby';

var instance = bilby
    .method('flatMap', isBacon, (observable, f) => observable.flatMap(f))
    .method('map',     isBacon, (observable, f) => observable.map(f))
    .method('pure', strictEquals(Bacon), (m, v) => constant(v))
;

function isBacon(v) {
    return v && v.toEventStream === 'function';
}

export default instance;
