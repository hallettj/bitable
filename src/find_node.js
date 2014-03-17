import { compare, dist, equals } from './id';
import RouteTable                from './route_table';
import M                         from './message';
import { reject }                from 'when/when';
import {
    EventStream,
    End,
    Next,
    fromArray,
    fromPromise,
    merge,
    mergeAll,
    never,
    once
} from 'Bacon';
import {
    drop,
    first,
    into,
    sorted_set_by,
    take
} from 'mori';

export {
    execute,
    react
};

function react(idSelf, routeTable, query) {
    var msg     = query.message
      , respond = query.respond
      , origin  = msg.a.id
      , target  = msg.a.target;
    // When a node joins it does a find_node query on itself.
    // So exclude the querying node from results.
    var results = routeTable.closest(target).filter(
        peer => compare(peer.id, origin) !== 0
    );
    if (results.length > 0 && compare(results[0].id, target) === 0) {
        results = results.slice(0, 1);
    }
    respond({
        id: idSelf,
        nodes: results
    });
}

// shared peer pool, no side effects, waits for all threads to
// converge at each iteration
function execute(idSelf, routeTable, alpha, query, target) {
    var startPeers = routeTable.closest(target).slice(0, alpha);

    function helper(state) {
        var closest = first(state);

        if (!closest) {
            return never();
        }

        if (compare(closest.id, target) === 0) {
            return once(closest);
        }

        var threads = take(alpha, state).map(thread);

        var rec = mergeAll(threads).fold(
            state,
            (state_, resp) => into(state_, resp.results)
        )
        .onValue(helper);
        // TODO: waits at each iteration for all threads to finish

        return mergeAll(threads).flatMap(resp => fromArray(resp.results)).merge(rec);
    }

    function thread(peer) {
        return fromPromise(
            query(peer, M.find_node(idSelf, target))
        );
    }

    return helper(
        into(sorted_set_by(
            (a, b) => compare(dist(target, a.id), dist(target, b.id))
        ), startPeers)
    );
}

// shared peer pool, side effects, does not wait for convergence,
// if match is found may not be last event emitted?
function execute(idSelf, routeTable, alpha, query, target) {
    var startPeers = routeTable.closest(target).slice(0, alpha);
    var complete   = false;

    var state = into(sorted_set_by(function(a, b) {
        return compare(dist(target, a.id), dist(target, b.id));
    }), startPeers);

    var threads = startPeers.map(thread);

    function thread() {
        var closest = first(state);
        state = drop(1, state);

        if (!closest || complete) {
            return never();
        }

        if (compare(closest.id, target) === 0) {
            complete = true;
            return once(closest);
        }

        // TODO: make recursive call on error in query
        return merge(
            once(closest),
            fromPromise(
                query(closest, M.find_node(idSelf, target))
            )
            .flatMap(resp => {
                state = into(resp.results);
                return thread();
            })
        );
    }

    return mergeAll(threads);
}


function findNode(target) {
    return new EventStream(subscriber => {
        var startPeers = RouteTable.closest(target).slice(0, alpha);
        for (var i = 0; i < alpha; i += 1) {
            findNode_(target, subscriber, startPeers.slice(i, i+1));
        }
        return function unsubscribe() {};
    });
}

function findNode_(target, subscriber, peers, lastDist) {
    if (peers.length < 1) {
        return reject('out of peers');
    }

    return bus.query(peers[0], M.find_node(idSelf, target)).then(
    resp => {
        var nodes = resp.r.nodes.sort(
            (a, b) => compare(dist(target, a.id), dist(target, b.id))
        ).filter(
            node => !lastDist || compare(dist(node.id, target), lastDist) < 0
        );
        var closest = nodes.length && dist(nodes[0].id, target);
        if (nodes.length && equals(nodes[0].id, target)) {
            subscriber(new Next(nodes[0]));
            subscriber(new End());
            return nodes[0];
        }
        else {
            nodes.forEach(node => {
                subscriber(new Next(node));
            });
            return findNode_(target, subscriber, nodes, closest || lastDist);
        }
    },
    // backtrack
    () => findNode_(target, subscriber, peers.slice(1), lastDist)
    );
}
