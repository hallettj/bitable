define('kademlia/bus', ['./message', 'peerjs', 'when', 'Bacon'], function(m, Peer, when, Bacon) {
    'use strict';

    function Bus(id, brokerInfo) {
        var peer = new Peer(id, brokerInfo)
          , connections  = {}
          , pending      = {}
          , transactions = {}
        ;

        var messages     = new Bacon.Bus();
        var connectEvents = new Bacon.Bus();
        var closeEvents  = new Bacon.Bus();

        peer.on('connection', function(conn) {
            // TODO: clean up previous connection?
            console.log('incoming connection', conn.peer);
            initConnection(conn);
        });
        peer.on('error', function() {
            console.error.apply(console, arguments);
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
            return connect(peer).then(function(conn) {
                return transaction(function(transId) {
                    dispatch(conn, transId, message);
                });
            });
        }

        function dispatch(conn, transId, message) {
            conn.send(m.build(message, transId));
        }

        /**
         * Establish a long-lived connection.
         */
        function connect(peer) {
            return getConnection(peer.id).then(function(conn) {
                return conn;
            }, function() {
                console.log('not connected yet; connecting now', peer.id);
                return withBroker(peer, function(broker) {
                    var conn = broker.connect(peer.id, {
                        reliable: false
                    });
                    return initConnection(conn);
                });
            });
        }

        function disconnect(otherId) {
            getConnection(otherId).then(function(conn) {
                conn.close();
            });
        }

        function destroy() {
            Object.keys(connections).forEach(function(k) {
                disconnect(k);
            });
        }

        function initConnection(conn) {
            var id = conn.peer
              , alreadyOpen = conn.open
              , deferred = when.defer();
            if (alreadyOpen) {
                connections[id] = conn;
                deferred.resolve(conn);
            }
            else {
                pending[id] = deferred.promise;
            }
            var stream = new Bacon.EventStream(function(subscriber) {
                conn
                .on('open', function() {
                    connections[id] = conn;
                    delete pending[id];
                    deferred.resolve(conn);
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
                    deferred.reject(err);
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
            deferred.promise.then(function() {
                connectEvents.push({
                    id: id
                });
            });
            return deferred.promise;
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
            if (connections[id]) {
                return when.resolve(connections[id]);
            }
            else if (pending[id]) {
                return pending[id];
            }
            else {
                return when.reject();
            }
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
            destroy:     destroy,
            messages:    messages,
            connectEvents: connectEvents,
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
