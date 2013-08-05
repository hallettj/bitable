/*jshint latedef:false */

define('kademlia/dht', [
    './id',
    './route_table',
    './bus',
    './message',
    'lodash',
    'when',
    'Bacon'
], function(Id, RouteTable, Bus, m, _, when, Bacon) {
    'use strict';

    function DHT(opts) {
        opts = _.assign({}, defaults, opts);

        var idSelf = opts.id || Id.random(opts.idSize)
          , alpha  = opts.alpha
          , routeTable = new RouteTable(idSelf, opts.idSize, opts.bucketSize)
          , bus        = new Bus(idSelf, opts.brokerInfo)
        ;

        bus.messages.onValue(react);
        bus.closeEvents.onValue(function(id) {
            // TODO: attempt to reconnect?  handle that in bus?
            routeTable.remove(id);
        });

        function bootstrap(peers) {
            return when.any(peers.map(connect)).then(function() {
                findNode(idSelf).onValue(connect);
            });
        }

        function connect(peer) {
            return bus.connect(peer).then(function() {
                // TODO: return promise from routeTable.insert,
                // disconnect on fail
                routeTable.insert(peer);
                return peer;
            });
        }

        function ping(peer) {
            return bus.query(peer, m.ping(idSelf));
        }

        function findNode(target) {
            return new Bacon.EventStream(function(subscriber) {
                var startPeers = routeTable.closest(target).slice(0, alpha);
                for (var i = 1; i < alpha; i += 1) {
                    findNode_(target, subscriber, startPeers.slice(i, i+1));
                }
                return function unsubscribe() {};
            });
        }

        function findNode_(target, subscriber, peers) {
            if (peers.length < 1) {
                return when.reject('out of peers');
            }

            return bus.query(peers[0], m.find_node(idSelf, target)).then(
            function(resp) {
                var nodes = resp.r.nodes.sort(function(a, b) {
                    return Id.compare(Id.dist(target, a), Id.dist(target, b));
                });
                if (nodes.length && Id.equals(nodes[0], target)) {
                    subscriber(new Bacon.Next(nodes[0]));
                    subscriber(new Bacon.End());
                    return nodes[0];
                }
                else {
                    nodes.forEach(function(node) {
                        subscriber(new Bacon.Next(node));
                    });
                    return findNode_(target, subscriber, nodes);
                }
            },
            function() {
                // backtrack
                return findNode_(peers.slice(1));
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

        function react(incoming) {
            var msg     = incoming[0]
              , respond = incoming[1];
            if (msg.q === 'ping') {
                reactPing(msg, respond);
            }
            else if (msg.q === 'find_node') {
                reactFindNode(msg, respond);
            }
        }

        function reactPing(msg, respond) {
            console.log('reactPing', msg);
            respond(m.response({
                id: idSelf
            }));
        }

        function reactFindNode(msg, respond) {
            var origin = msg.a.id;
            var target = msg.a.target;
            var results = routeTable.closest(target).filter(function(peer) {
                return Id.compare(peer.id, origin) !== 0;
            });
            if (results.length > 0 && Id.compare(results[0], target) === 0) {
                results = results.slice(0, 1);
            }
            respond(m.response({
                id: idSelf,
                nodes: results
            }));
        }

        return {
            bootstrap: bootstrap,
            messages:  bus.messages,
            connectEvents: bus.connectEvents,
            closeEvents: bus.closeEvents,
            ping:      ping
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
