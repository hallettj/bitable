define('kademlia/bus', ['./message', 'peerjs', 'when', 'Bacon'], function(m, Peer, when, Bacon) {
    'use strict';

    function Bus(id, brokerInfo) {
        var peer = new Peer(id, brokerInfo)
          , connections  = {}
          , transactions = {}
        ;

        var messages     = new Bacon.Bus();
        var closeEvents  = new Bacon.Bus();

        peer.on('connection', function(conn) {
            // TODO: clean up previous connection?
            initConnection(conn);
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
        function query(peer, message) {
            var conn = connections[peer.id];
            if (!conn) {
                console.log('not connected yet; connecting now', peer.id);
                return connect(peer).then(function() {
                    return query(peer, message);
                });
            }

            return transaction(function(transId) {
                dispatch(conn, transId, message);
            });
        }

        function dispatch(conn, transId, message) {
            conn.send(m.build(message, transId));
        }

        /**
         * Establish a long-lived connection.
         */
        function connect(peer) {
            return withBroker(peer, function(broker) {
                return when.promise(function(resolve, reject) {
                    var conn = broker.connect(peer.id, {
                        reliable: false
                    });
                    initConnection(conn);
                    conn.on('open', function() {
                        resolve(conn);
                    });
                    conn.on('error', reject);
                });
            });
        }

        function disconnect(otherId) {
            getConnection(otherId).then(function(conn) {
                conn.close();
            });
        }

        function initConnection(conn) {
            var id = conn.peer;
            var stream = new Bacon.EventStream(function(subscriber) {
                conn
                .on('open', function() {
                    connections[id] = conn;
                })
                .on('data', function(data) {
                    var msg = m.decode(data);
                    if (!react(msg)) {
                        // Emit events only for incoming queries
                        subscriber(new Bacon.Next([msg, function(resp) {
                            dispatch(conn, msg.t, resp);
                        }]));
                    }
                })
                .on('error', function(err) {
                    subscriber(new Bacon.Error(err));
                })
                .on('close', function() {
                    if (connections[id] === conn) {
                        delete connections[id];
                    }
                    closeEvents.push(id);
                    subscriber(new Bacon.End());
                });
                return function unsubscribe() {
                    conn.close();  // TODO: This triggers a 'close' event, right?
                };
            });
            messages.plug(stream);
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
            return when.resolve(connections[id]);
            // TODO: connect to peer if not already connected
            // TODO: this should go through routing table?
        }

        //// TODO: reuse broker connections where convenient
        //// TODO: create new module to manage broker pool
        //function withBroker(brokerInfo, fn) {
        //    return when.promise(function(resolve, reject, notify) {
        //        var peer = new Peer(id, brokerInfo);
        //        peer.on('error', reject);

        //        var promise = fn(peer);
        //        promise.then(resolve, reject, notify);
        //        promise.ensure(function() {
        //            peer.disconnect();
        //        });
        //    });
        //}

        // TODO: implement real broker functionality
        function withBroker(brokerInfo, fn) {
            return when.promise(function(resolve, reject, notify) {
                // use bus-wide peer reference
                peer.on('error', reject);
                var promise = fn(peer);
                promise.then(resolve, reject, notify);
            });
        }

        function transaction(fn) {
            var id = mkTransactionId()
              , deferred = when.defer();
            transactions[id] = deferred;
            fn(id);
            return deferred.promise;
        }

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

        return {
            query:       query,
            connect:     connect,
            disconnect:  disconnect,
            messages:    messages,
            closeEvents: closeEvents
        };
    }

    return Bus;

    //function react(conn, msg) {
    //    if (msg.y === 'q' && msg.q === 'ping') {
    //        sendPong(conn, msg);
    //    }
    //};

    //function sendPong(conn, msg) {
    //    if (msg.a && msg.a.id && msg.t) {
    //        conn.send({
    //            t: msg.t,
    //            y: 'r',
    //            r: { id: selfId }
    //        });
    //    }
    //};

});
