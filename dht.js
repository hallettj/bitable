define('kademlia/dht', [
    './id',
    './route_table',
    './bus',
    './message',
    'lodash'
], function(Id, RouteTable, Bus, m, _) {
    'use strict';

    function DHT(opts) {
        opts = _.assign({}, defaults, opts);

        var idSelf = opts.id || Id.random(opts.idSize)
          , routeTable = new RouteTable(idSelf, opts.idSize, opts.bucketSize)
          , bus        = new Bus(idSelf, opts.brokerInfo)
        ;

        bus.onValue(function(event) {
        });

        bus.closeEvents.onValue(function(id) {
            // TODO: attempt to reconnect?
            routeTable.remove(id);
        });

        // bootstrap
        opts.peers.forEach(routeTable.insert);
        opts.peers.forEach(function(peer) {
            send(m.findNode, peer);
        });

    }

    function Peer(id) {
        var peer = { id: id };
        peer.status = 'good';
        return peer;
    }

    var defaults = {
        id: undefined,
        peers: undefined,  // array of starting peers
        brokerInfo: undefined,
        idSize: 20 /* bytes */,
        bucketSize: 8
    };

    return DHT;
});
