define('bitstar/broker', [
    './peer',
    './functional_utils',
    'peerjs',
    'Bacon',
    'lodash'
], function(Peer, F, PeerJs, Bacon, _) {
    'use strict';

    var Events = F.data({
        connection: function(broker, conn) {
            return {
                dir:    'incoming',
                peer:   Peer.create(conn.id, conn, broker),
                broker: broker
            };
        },
        open: function(broker) {
            return {
                broker: broker
            };
        },
        close: function(broker) {
            return {
                broker: broker
            };
        }
    });

    function connect(idSelf, options) {
        var broker = new PeerJs(idSelf, options);
        var res    = {
            conn: broker
        };
        res.events = events(res);
        _.assign(res, options);
        return Object.freeze(res);
    }

    // :: bitstar/broker -> ()
    function disconnect(broker) {
        // TODO: Does 'close' event fire after this?
        broker.conn.disconnect();
    }

    // :: bitstar/broker -> Bacon.EventStream
    function events(broker) {
        var conn = broker.conn;
        var evts = new Bacon.EventStream(function(subscriber) {
            subscriber(new Bacon.Next(function() {
                return Events.brokerConnection(broker);
            }));

            conn.on('connection', function(conn) {
                subscriber(new Bacon.Next(function() {
                    return Events.peerConnection(broker, conn);
                }));
            });
            conn.on('open', function() {
                subscriber(new Bacon.Next(function() {
                    return Events.open(broker);
                }));
            });
            conn.on('error', function(err) {
                subscriber(new Bacon.Error(err));
            });
            conn.on('close', function() {
                subscriber(new Bacon.Next(function() {
                    return Events.close(broker);
                }));
                subscriber(new Bacon.End());
            });
            return function unsubscribe() {
                conn.disconnect();
            };
        }).endOnError();
        return evts;
    }

    function Broker(idSelf, options) {
        var self   = {};
        var broker = new PeerJs(idSelf, options);
        var events = new Bacon.EventStream(function(subscriber) {
            broker.on('connection', function(conn) {
                subscriber(new Bacon.Next(function() {
                    return Object.freeze({
                        type: 'connection',
                        dir: 'incoming',
                        peer: Peer.create(conn.id, conn, self),
                        conn: conn,
                        broker: self
                    });
                }));
            });
            broker.on('open', function() {
                subscriber(new Bacon.Next({
                    type: 'open',
                    broker: self
                }));
            });
            broker.on('error', function(err) {
                subscriber(new Bacon.Error(err));
            });
            broker.on('close', function() {
                subscriber(new Bacon.Next({
                    type:   'close',
                    broker: self
                }));
                subscriber(new Bacon.End());
            });
            return function unsubscribe() {
                broker.disconnect();
            };
        }).endOnError();
        var outgoing = new Bacon.Bus();

        events.onEnd(function() {
            outgoing.end();
        });

        function connect(id, options) {
            var conn = broker.connect(id, options);
            var peer = new Peer(self, conn);
            outgoing.push({
                type:   'connection',
                dir:    'outgoing',
                peer:   peer,
                broker: self
            });
            return peer;
        }

        function disconnect() {
            broker.disconnect();
            outgoing.end();
        }

        return _.assign(self, {
            connect:    connect,
            disconnect: disconnect,
            events:     Bacon.mergeAll(events, outgoing),
            info:       options
        });
    }

    return {
        Events:     Events,
        connect:    connect,
        disconnect: disconnect
    };
});
