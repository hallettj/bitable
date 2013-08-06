/*globals require */

require.config({
    baseUrl: '/',
    paths: {
        'kademlia': 'src',
        'when': 'node_modules/when',
        //'when': 'node_modules/when/when',
        //'when/timed': 'node_modules/when/timed',
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

require([
    'kademlia/dht',
    'kademlia/id',
    'jquery'
], function(DHT, Id, $) {
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

    (function syncStats() {
        var connects = dht.connectEvents;
        var disconnects = dht.closeEvents;
        var connectionEvents = connects.merge(disconnects);

        connectionEvents.onValue(function() {
            var count = dht.routeTable.getNodes().length;
            $('#stats .nodeId').text(self.id);
            $('#stats .peerCount').text(count);
        });
    }());

    var broadcasts = [];

    dht.messages.onValue(function(incoming) {
        var msg     = incoming[0]
          , respond = incoming[1];
        if (msg.q === 'broadcast') {
            rebroadcast(msg.a, respond);
            onbroadcast(msg.a);
        }
    });

    function onbroadcast(params) {
        $('#posts').prepend(
            $('<li>').text(params.data + ' -- ' + params.origin)
        );
    }

    function broadcast(msg) {
        dht.routeTable.getBuckets().forEach(function(bucket) {
            var peers = bucket.slice(0, 3);
            peers.forEach(function(peer) {
                dht.query(peer, 'broadcast', {
                    origin: self.id,
                    id: self.id,
                    token: Id.random(),
                    data: msg
                });
            });
        });
    }

    function rebroadcast(params, respond) {
        if (broadcasts[params.token]) { return; }
        broadcasts[params.token] = new Date();

        var from = params.id;
        respond({
            id: self.id,
            token: params.token
        });
        dht.routeTable.getNodes().filter(function(node) {
            return Id.compare(Id.dist(node.id, self.id), Id.dist(node.id, from)) < 0;
        }).forEach(function(node) {
            dht.query(node, 'broadcast', {
                id: self.id,
                origin: params.origin,
                token: params.token,
                data: params.data
            });
        });
    }

    window.meow = function() {
        var nonce = Math.floor(Math.random() * 10000)
          , data  = "meow"+ nonce;
        broadcast(data);
    };

    setInterval(function() {
        var cutoff = new Date() - 600000;
        Object.keys(broadcasts).forEach(function(token) {
            if (broadcasts[token] < cutoff) {
                delete broadcasts[token];
            }
        });
    }, 600000);

    console.log('ready', self.id, self);

    if (bootstrapId) {
        dht.bootstrap([{
            id: bootstrapId,
            host: "zinc.sitr.us",
            port: 9000
        }]);
    }

    dht.connectEvents.onValue(function(peer) {
        var msg = "connected to "+ peer.id;
        console.log('connection', peer.id, peer);
    });

    dht.closeEvents.onValue(function(id) {
        var msg = "lost connection to"+ id;
        console.log('lost connection', id);
    });

    dht.messages.onError(function(err) {
        console.error(err);
    });

    function param(key) {
        var exp = new RegExp('\\b'+ key +'=([^&=]+)');
        var matches = exp.exec(window.location);
        return matches && matches[1];
    }

    window.self = self;
    window.dht  = dht;
});
