/*jshint latedef:false */

define('bitstar/dht', [
    './id',
    './route_table',
    './bus',
    './message',
    'lodash',
    'when/when',
    'Bacon'
], function(Id, RouteTable, Bus, m, _, when, Bacon) {
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
                findNode(idSelf).onValue(connect);
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

        function ping(peer) {
            return bus.query(peer, m.ping(idSelf));
        }

        function findNode(target) {
            return new Bacon.EventStream(function(subscriber) {
                var startPeers = routeTable.closest(target).slice(0, alpha);
                for (var i = 0; i < alpha; i += 1) {
                    findNode_(target, subscriber, startPeers.slice(i, i+1));
                }
                return function unsubscribe() {};
            });
        }

        function query(peer, type, params) {
            return bus.query(peer, m.query(type, params));
        }

        function findNode_(target, subscriber, peers, lastDist) {
            if (peers.length < 1) {
                return when.reject('out of peers');
            }

            return bus.query(peers[0], m.find_node(idSelf, target)).then(
            function(resp) {
                var nodes = resp.r.nodes.sort(function(a, b) {
                    return Id.compare(Id.dist(target, a.id), Id.dist(target, b.id));
                }).filter(function(node) {
                    return !lastDist || Id.compare(Id.dist(node.id, target), lastDist) < 0;
                });
                var closest = nodes.length && Id.dist(nodes[0].id, target);
                if (nodes.length && Id.equals(nodes[0].id, target)) {
                    subscriber(new Bacon.Next(nodes[0]));
                    subscriber(new Bacon.End());
                    return nodes[0];
                }
                else {
                    nodes.forEach(function(node) {
                        subscriber(new Bacon.Next(node));
                    });
                    return findNode_(target, subscriber, nodes, closest || lastDist);
                }
            },
            function() {
                // backtrack
                return findNode_(target, subscriber, peers.slice(1), lastDist);
            });
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
                reactFindNode(msg, respond);
            }
        }

        function reactPing(msg, respond) {
            respond({
                id: idSelf
            });
        }

        function reactFindNode(msg, respond) {
            var origin = msg.a.id;
            var target = msg.a.target;
            // When a node joins it does a find_node query on itself.
            // So exclude the querying node from results.
            var results = routeTable.closest(target).filter(function(peer) {
                return Id.compare(peer.id, origin) !== 0;
            });
            if (results.length > 0 && Id.compare(results[0].id, target) === 0) {
                results = results.slice(0, 1);
            }
            respond({
                id: idSelf,
                nodes: results
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
