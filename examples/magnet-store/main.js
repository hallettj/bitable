/*globals require */

require.config({
    baseUrl: '/',
    paths: {
        'kademlia': 'src',
        'when': 'node_modules/when/when',
        'lodash': 'node_modules/lodash/dist/lodash',
        'Bacon': 'node_modules/baconjs/dist/Bacon',
        'peerjs': 'node_modules/peerjs/dist/peer',
        'bencode-js': 'node_modules/bencode-js/bencode',
        'stringview': 'lib/stringview'
    },
    shim: {
        'bencode-js': {
            exports: 'Bencode'
        },
        'peerjs': {
            exports: 'Peer'
        }
    },
    enforceDefine: true
});

require(['kademlia/dht', 'kademlia/id'], function(DHT, Id) {
    'use strict';
    var id = Id.random();
    var self = {
        id: id,
        host: 'zinc.sitr.us',
        port: 9000
    };
    window.self = self;
    window.dht = new DHT({
        id: id,
        brokerInfo: { host: 'zinc.sitr.us', port: 9000 }
    });
    console.log('ready', self);
});
