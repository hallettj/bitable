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

    var id = param('id') || Id.random();
    var bootstrapId = param('bootstrap');

    var self = {
        id: id,
        host: 'zinc.sitr.us',
        port: 9000
    };
    var dht = new DHT({
        id: id,
        brokerInfo: { host: 'zinc.sitr.us', port: 9000 }
    });

    console.log('ready', self.id, self);
    log('online as '+ self.id);

    if (bootstrapId) {
        log('connecting to '+ bootstrapId);
        dht.bootstrap([{
            id: bootstrapId,
            host: "zinc.sitr.us",
            port: 9000
        }]);
    }

    dht.connectEvents.onValue(function(peer) {
        var msg = "connected to "+ peer.id;
        console.log('connection', peer.id, peer);
        log(msg);
    });

    dht.closeEvents.onValue(function(id) {
        var msg = "lost connection to"+ id;
        console.log('lost connection', id);
        log(msg);
    });

    dht.messages.onError(function(err) {
        console.error(err);
    });

    function log(msg) {
        var $log = $('#log');
        $log.val($log.val() + "\n" + msg);
    }

    function param(key) {
        var exp = new RegExp('\\b'+ key +'=([^&=]+)');
        var matches = exp.exec(window.location);
        return matches && matches[1];
    }

    window.self = self;
    window.dht  = dht;
});
