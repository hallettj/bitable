import BrokerPool        from './broker_pool';
import M                 from './message';
import { defer, reject } from 'when/when';
import T                 from 'when/timed';
import Bacon             from 'Bacon';
import { never, once }   from 'Bacon';

export default Bus;

function Bus(idSelf, brokerInfo) {
    var connections  = {}
      , transactions = {}
      , timeout      = 1000
    ;

    var events = new Bacon.Bus();
    var queries = events.filter(event => event.type === 'query');
    var connects = events.flatMap(
        event => event.type === 'open' && event.peer ? once(event.peer) : never()
    );
    var disconnects = events.flatMap(
        event => event.type === 'close' && event.peer ? once(event.peer) : never()
    );

    var brokers = new BrokerPool(idSelf);
    brokers.connect(brokerInfo);

    brokers.events.onValue(v => {
        if (v.type === 'connection' && v.dir === 'incoming') {
            var promise = initConnection(v.peer);
            connections[v.peer.id] = getConnection(v.peer.id).then(noop, () => promise);
        }
    });

    disconnects.onValue(conn => {
        var promise = getConnection(conn.peer).then(
            conn_ => conn_ === conn ? reject() : conn_,
            () => {
                if (connections[conn.peer] === promise) {
                    delete connections[conn.peer];
                }
            }
        );
        connections[conn.peer] = promise;

        // TODO: This could be made simpler if callbacks on resolved
        // promises executed synchronously.  Since they are async we
        // have to account for the possibility of a new connection
        // or connection attempt taking place while checking whether
        // the connection should be removed from the connections
        // collection.
    });

    // TODO: attempt to reconnect when connection has been lost
    // TODO: make errors loggable
    // TODO: API to shut down all connections

    /**
     * Send a message using an existing connection; or establish
     * a short-lived connection if necessary.
     *
     * TODO: limit to short-lived connection!
     */
    function query(peerInfo, message) {
        return connect(peerInfo).then(peer => transaction(transId => {
            dispatch(peer, transId, message);
        }));
    }

    function dispatch(peer, transId, message) {
        peer.send(M.build(message, transId));
    }

    /**
     * Establish a long-lived connection.
     */
    function connect(peerInfo) {
        var promise = getConnection(peerInfo.id).then(noop, () => {
            console.log('not connected yet; connecting now', peerInfo.id);
            return brokers.withBroker(peerInfo, broker => {
                var peer = broker.connect(peerInfo.id, {
                    reliable: false,
                    serialization: 'none'
                });
                return initConnection(peer);
            });
        });
        connections[peerInfo.id] = promise;
        return promise;
    }

    function initConnection(peer) {
        events.plug(peer.events);
        events.plug(peer.events.flatMap(v => {
            if (v.type === 'data') {
                var msg = M.decode(v.data);
                if (!react(msg)) {
                    return once({
                        type: 'query',
                        peer: peer,
                        message: msg,
                        respond: resp => {
                            dispatch(peer.conn, msg.t, M.response(resp));
                            // TODO: response should not be required
                            // to use same connection
                        },
                    });
                }
                else {
                    return once({
                        type: 'response',
                        peer: peer,
                        message: msg
                    });
                }
            }
            else {
                return never();
            }
        }));
        return peer.onReady();
    }

    function disconnect(otherId) {
        getConnection(otherId).then(conn => {
            conn.close();
        });
    }

    function destroy() {
        Object.keys(connections).forEach(k => {
            disconnect(k);
        });
    }

    function react(message) {
        var isResp   = message.y === 'r' && message.t;
        var deferred = isResp && transactions[message.t];
        if (deferred) {
            deferred.resolve(message);
            delete transactions[message.t];
        }
        return !!deferred;
    }

    function getConnection(id) {
        return connections[id] || reject();
    }

    function transaction(fn) {
        var id = mkTransactionId()
          , deferred = defer()
          , timed    = T.timeout(timeout, deferred.promise);
        transactions[id] = deferred;
        fn(id);
        timed.then(noop, () => {
            if (transactions[id] === deferred) {
                delete transactions[id];
            }
        });
        return timed;
    }

    // TODO: id should be made up of arbitrary bytes, not just alpha
    // chars
    function mkTransactionId() {
        var id = randChar() + randChar();
        if (transactions.hasOwnProperty(id)) {
            return mkTransactionId();
        }
        return id;
    }

    function randChar() {
        var x = Math.floor(Math.random() * 26);
        return String.fromCharCode(97 + x);
    }

    function noop(x) { return x; }

    return {
        query:       query,
        connect:     connect,
        disconnect:  disconnect,
        destroy:     destroy,
        events:      events.merge(brokers.events),
        queries:     queries,
        connects:    connects,
        disconnects: disconnects
    };
}
