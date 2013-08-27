/*jshint latedef:false */

define('bitstar/dht', [
    './id',
    './route_table',
    './bus',
    './message',
    './find_node',
    'lodash',
    'when/when',
    'Bacon',
    'mori'
], function(Id, RouteTable, Bus, m, find_node, _, when, Bacon, mori) {
    'use strict';

    function DHT(opts) {
        opts = _.assign({}, defaults, opts);

        var idSelf     = opts.id || Id.random(opts.idSize)
          , alpha      = opts.alpha
          , routeTable = new RouteTable(idSelf, opts.idSize, opts.bucketSize)
          , bus        = new Bus(idSelf, opts.brokerInfo)
        ;

        bus.queries.onValue(react);
        bus.connects.onValue(routeTable.insert);
        bus.disconnects.onValue(routeTable.remove);
        // TODO: attempt to reconnect?  handle that in bus?

        setInterval(function() {
            routeTable.getNodes().forEach(function(node) {
                checkHealth(node, 3).then(function() {
                    // connection is good
                }, function(err) {
                    console.log('bad health check, disconnecting', node.id, err);
                    routeTable.remove(node.id);
                    bus.disconnect(node.id);
                });
            });
        }, 60000);

        function bootstrap(peers) {
            return when.any(peers.map(connect)).then(function() {
                find_node.execute(routeTable, alpha, bus.query, idSelf).onValue(connect);
            });
        }

        function destroy() {
            return bus.destroy();
        }

        function connect(peer) {
            return bus.connect(peer).then(function() {
                // TODO: return promise from routeTable.insert,
                // disconnect on fail
                routeTable.insert(peer);
                return peer;
            });
        }

        function query(peer, type, params) {
            return bus.query(peer, m.query(type, params));
        }

        function ping(peer) {
            return bus.query(peer, m.ping(idSelf));
        }

        function checkHealth(peer, n) {
            return ping(peer).then(function() {
                // got response
            }, function() {
                if (n > 0) {
                    return when.delay(1000).then(function() {
                        return checkHealth(peer, n - 1);
                    });
                }
            });
        }

        //function findNode_(target) {
        //    var events = new Bacon.Bus();
        //    var peers = routeTable.closest(target).slice(0, alpha);
        //    peers.forEach(function(peer) {
        //        return bus.query(peer, m.find_node(idSelf, idSelf));
        //    });
        //    return events;
        //}

        // TODO: Move responses for built-in query-types into a separate
        // module.  Make it possible to substitute different behavior.
        function react(query) {
            var msg     = query.message
              , respond = query.respond;
            if (msg.q === 'ping') {
                reactPing(msg, respond);
            }
            else if (msg.q === 'find_node') {
                find_node.react(idSelf, routeTable, query);
            }
        }

        function reactPing(msg, respond) {
            respond({
                id: idSelf
            });
        }

        return {
            bootstrap:   bootstrap,
            events:      bus.events,
            connects:    bus.connects,
            queries:     bus.queries,
            disconnects: bus.disconnects,
            routeTable:  routeTable,
            ping:        ping,
            findNode:    findNode,
            query:       query,
            connect:     connect,
            destroy:     destroy
        };
    }

    //function Peer(id) {
    //    var peer = { id: id };
    //    peer.status = 'good';
    //    return peer;
    //}

    var defaults = {
        id: undefined,
        brokerInfo: undefined,
        idSize: 20 /* bytes */,
        bucketSize: 8,
        alpha: 3  // number of lookup queries to run in parallel
    };

    return DHT;
});
