import { decode, encode } from 'bencode-js';
import { assign }         from 'lodash';

export {
    decode,
    encode,
    find_node,
    ping,
    query,
    response,
    build
};

function ping(self) {
    return query('ping', {
        id: self
    });
}

function find_node(self, target) {
    return query('find_node', {
        id: self,
        target: target
    });
}

function query(type, params) {
    return {
        y: 'q',
        q: type,
        a: params
    };
}

function response(params) {
    return {
        y: 'r',
        r: params
    };
}

function build(message, transactionId) {
    return encode(assign({
        t: transactionId
    }, message));
}
