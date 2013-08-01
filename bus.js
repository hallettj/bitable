/**
 * when: https://github.com/cujojs/when
 */

define('kademlia/bus', ['./message', 'peerjs', 'when', 'bacon'], function(m, peerjs, when, Bacon) {
    'use strict';

    function Bus(id, brokerInfo) {
        var peer = new peerjs.Peer(id, brokerInfo)
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

        function send(peer, message) {
            var conn = connections[peer.id];
            if (!conn) {
                return connect(peer.id, peer.brokerInfo).then(function() {
                    return send(peer, message);
                });
            }
            return transaction(function(id) {
                conn.send(m.build(message, id));
            });
        }

        function initConnection(conn) {
            var id = conn.peer.id;
            var stream = new Bacon.EventStream(function(subscriber) {
                conn
                .on('open', function() {
                    connections[id] = conn;
                })
                .on('data', function(data) {
                    subscriber(new Bacon.Next(function() {
                        m.decode(data);
                    }));
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

        function connect(otherId, brokerInfo) {
            return withBroker(brokerInfo, function(peer) {
                return when.promise(function(resolve, reject) {
                    var conn = peer.connect(otherId, {
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

        function getConnection(id) {
            return when.resolve(connections[id]);
            // TODO: connect to peer if not already connected
            // TODO: this should go through routing table?
        }

        // TODO: reuse broker connections where convenient
        function withBroker(brokerInfo, fn) {
            return when.promise(function(resolve, reject, notify) {
                var peer = new peerjs.Peer(id, brokerInfo);
                peer.on('error', reject);

                var promise = fn(peer);
                promise.then(resolve, reject, notify);
                promise.ensure(function() {
                    peer.disconnect();
                });
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
            send:        send,
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
