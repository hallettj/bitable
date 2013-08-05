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
        'stringview': 'lib/stringview',
        'jquery': 'lib/jquery/jquery'
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

require(['kademlia/dht', 'kademlia/id', 'jquery'], function(DHT, Id, $) {
    'use strict';

    var isPrime = !!/\?.*prime/.exec(window.location);
    var id = isPrime ? "bd48eb8ac5242d3d9e730a00a0ccc46ca925158b" : Id.random();

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

    if (!isPrime) {
        window.dht.bootstrap([{
            id: "bd48eb8ac5242d3d9e730a00a0ccc46ca925158b",
            host: "zinc.sitr.us",
            port: 9000
        }]);
    }

    window.dht.connectEvents.onValue(function(conn) {
        var msg = "connected to "+ conn.peer;
        console.log('connection', conn.peer, conn);
        log(msg);
    });

    window.dht.closeEvents.onValue(function(id) {
        var msg = "lost connection to"+ id;
        console.log('lost connection', id);
        log(msg);
    });

    window.dht.messages.onError(function(err) {
        console.error(err);
    });

    function log(msg) {
        var $log = $('#log');
        $log.val($log.val() + "\n" + msg);
    }

    console.log('ready', self);
});
