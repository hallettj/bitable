import bilby            from 'bilby';
import { strictEquals } from 'bilby';

export {
    StateT,
    evalStateT,
    execStateT,
    runStateT,
    getBroker,
    put,
    modify,
    gets
};

/*
 * StateT is a monad transformer, meaning that it stacks the behavior of
 * the State monad onto another monad type.
 */
function StateT(s) {
    return Object.freeze({
        runStateT: s
    });
}

var instance = bilby
    .method('flatMap', isStateT,   flatMap)
    .method('map',     isStateT,   map)
    .method('pure',    stateTPath, pure)
    .method('lift',    isStateT,   lift)
;

function isStateT(v) {
    return typeof v.runStateT === 'function';
}

function stateTPath([type, _]) {
    return type === StateT;
}

// TODO: `map`, `flatMap`, and `pure` all recursively call their
// polymorphic frontends.  This implies load-order dependencies in monad
// implementations.

function map({runStateT}, f) {
    return StateT(state => {
        var innerMonad = runStateT(state);
        return instance.map(innerMonad, ({value, state}) => pair(state, f(value)));
    });
}

function flatMap({runStateT}, f) {
    return StateT(state => {
        var innerMonad = runStateT(state);
        return instance.flatMap(innerMonad,
            ({value, state}) => f(value).runStateT(state)
        );
    });
}

function pure([_, innerType], v) {
    return StateT(state => instance.pure(innerType, pair(state, v)));
}

function lift(_, innerMonad) {
    return StateT(state => instance.map(innerMonad, v => pair(state, v)));
}

function evalStateT({runStateT}, initState) {
    var innerMonad = runStateT(initState);
    return instance.map(innerMonad, ({value}) => value);
}

function execStateT({runStateT}, initState) {
    var innerMonad = runStateT(initState);
    return instance.map(innerMonad, ({state}) => state);
}

function runStateT(s, initState) {
    return s.runStateT(initState);
}

function get(innerType) {
    return StateT(state => instance.pure(innerType, pair(state, state)));
}

function put(innerType, newState) {
    return StateT(state => instance.pure(innerType, pair(newState, undefined)));
}

function modify(innerType, f) {
    return flatMap(get(innerType), state => put(innerType, f(state)));
}

function gets(innerType, f) {
    return map(get(innerType), f);
}

function pair(state, value) {
    return Object.freeze({
        state: state,
        value: value
    });
}
