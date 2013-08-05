/*globals require */

require.config({
    baseUrl: '/',
    paths: {
        'kademlia': 'src',
        'when': 'node_modules/when/when',
        'lodash': 'node_modules/lodash/dist/lodash',
        'Bacon': 'node_modules/baconjs/dist/Bacon',
        'peerjs': 'node_modules/peerjs/dist/peer',
        'bencode-js': 'node_modules/bencode-js/bencode'
    },
    shim: {
        'bencode-js': {
            exports: 'Bencode'
        }
    }
});

require(['kademlia/dht'], function(DHT) {
    console.log('got it', DHT);
});
