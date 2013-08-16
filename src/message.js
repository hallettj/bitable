define('bitstar/message', ['bencode-js', 'lodash'], function(b, _) {
    'use strict';

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
        return b.encode(_.assign({
            t: transactionId
        }, message));
    }

    return {
        decode:    b.decode,
        encode:    b.encode,
        find_node: find_node,
        ping:      ping,
        query:     query,
        response:  response,
        build:     build
    };
});
