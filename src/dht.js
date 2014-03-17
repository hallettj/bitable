/*jshint latedef:false */

import Id        from './id';
import Route     from './route_table';
import Bus       from './bus';
import Message   from './message';
import find_node from './find_node';
import when      from 'when/when';
import Bacon     from 'Bacon';
import { assign, compose, partial } from 'lodash';
import { combineWith, constant, mergeAll, never } from 'Bacon';

export {
    buildTable,
    trackConnections,
    withHealthChecks
};

function buildTable(idSelf, opts) {
    return constant(Route.create(idSelf, opts.idSize, opts.bucketSize));
}

function trackConnections(bus, table) {
    var withConnects = combineWith(Route.insert, table,        bus.connects);
    var withDisconns = combineWith(Route.remove, withConnects, bus.disconnects);
    // TODO: attempt to reconnect?  handle that in bus?
    return withDisconns;
}

function withHealthChecks(time, bus, routeTable) {
    // This callback runs every `time` milliseconds.
    var fails = routeTable.sampledBy(interval(time)).flatMap(table => {
        var failStreams = Route.peers(table).map(
            peer => Bacon.fromPromise(checkHealth(peer, 3))
            .flatMap(() => {
                log.info('successful health check', peer);
                // suppresses events from successful health checks
                return never();
            })
            .mapError(err => {
                log.info('bad health check', peer, err);
                return peer;
            })
        );
        return mergeAll(failStreams);
    });

    return combineWith((table, peer) => {
        log.info('disconnecting', peer);
        bus.disconnect(peer);
        log.info('removed from route table', peer);
        return Route.remove(table, peer);
    }, routeTable, fails);
}

function bootstrap(dht, initPeers) {
    return when.any(initPeers.map(partial(connect, dht))).then(() => {
        find_node.execute(routeTable, alpha, bus.query, idSelf).onValue(connect);
    });
}

function connect(dht, peer) {
    return dht.bus.connect(peer);
}

function DHT(opts) {
    opts = assign({}, defaults, opts);

    var idSelf     = opts.id || Id.random(opts.idSize)
      , alpha      = opts.alpha
      , bus        = new Bus(idSelf, opts.brokerInfo)
      , routeTable = compose(
            partial(withHealthChecks, 60000, bus),
            partial(trackConnections, bus)
        )(buildTable(idSelf, opts))
    ;

    bus.queries.onValue(react);

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
        return bus.query(peer, Message.query(type, params));
    }

    function ping(peer) {
        return bus.query(peer, Message.ping(idSelf));
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

var log = {
    info: console.log  // TODO: set log levels somewhere
};

function interval(time /* milliseconds */) {
    return Bacon.constant(1).sample(time);
}
