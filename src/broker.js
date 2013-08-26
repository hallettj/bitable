define('bitstar/broker', [
    './peer',
    'peerjs',
    'Bacon',
    'lodash'
], function(Peer, PeerJs, Bacon, _) {
    'use strict';

    function Broker(idSelf, options) {
        var self   = {};
        var broker = new PeerJs(idSelf, options);
        var events = new Bacon.EventStream(function(subscriber) {
            broker.on('connection', function(conn) {
                subscriber(new Bacon.Next(function() {
                    return {
                        type: 'connection',
                        dir: 'incoming',
                        peer: new Peer(self, conn),
                        conn: conn,
                        broker: self
                    };
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

    return Broker;
});
