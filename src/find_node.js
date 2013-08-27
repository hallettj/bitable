define('bitstar/find_node', [
    './id',
    './route_table',
    './bus',
    './message',
    'lodash',
    'when/when',
    'Bacon',
    'mori'
], function(Id, RouteTable, Bus, m, _, when, Bacon, mori) {
    'use strict';

    function react(idSelf, routeTable, query) {
        var msg     = query.message
          , respond = query.respond
          , origin  = msg.a.id
          , target  = msg.a.target;
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

    function execute(idSelf, routeTable, alpha, query, target) {
        var startPeers = routeTable.closest(target).slice(0, alpha);

        function helper(state) {
            var closest = mori.first(state);

            if (!closest) {
                return Bacon.never();
            }

            if (Id.compare(closest.id, target) === 0) {
                return Bacon.once(closest);
            }

            var threads = mori.take(alpha, state).map(thread);

            var rec = Bacon.combineAll(threads).fold(state, function(state_, resp) {
                return mori.into(state_, resp.results);
            })
            .onValue(helper);
            // TODO: waits at each iteration for all threads to finish

            return Bacon.combineAll(threads).flatMap(function(resp) {
                return Bacon.fromArray(resp.results);
            }).merge(rec);
        }

        function thread(peer) {
            return Bacon.fromPromise(
                query(peer, m.find_node(idSelf, target))
            );
        }

        return helper(
            mori.into(mori.sorted_set_by(function(a, b) {
                return Id.compare(Id.dist(target, a.id), Id.dist(target, b.id));
            }), startPeers)
        );
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

    return {
        execute: execute,
        react:   react
    };
});
