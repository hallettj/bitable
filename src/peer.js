define('bitstar/peer', [
    'when/when',
    'when/timed',
    'Bacon',
    'lodash'
], function(when, t, Bacon, _) {
    'use strict';

    function Peer(broker, conn, opts) {
        var self = {};
        var id = conn.peer;
        var timeout = (opts && opts.timeout) || 1000;
        var openEvent = new Bacon.Next({
            type: 'open',
            peer: self,
        });

        var stream = new Bacon.EventStream(function(subscriber) {
            var t;
            if (conn.open) {
                console.log('connection already open', id);
                subscriber(openEvent);
            }
            else {
                conn.on('open', function() {
                    console.log('connection open', id);
                    subscriber(openEvent);
                    clearTimeout(t);
                });
                if (timeout > 0) {
                    t = setTimeout(function() {
                        subscriber(new Bacon.Error('timeout connecting to '+ id));
                    }, timeout);
                }
            }
            conn
            .on('data', function(data) {
                subscriber(new Bacon.Next({
                    type: 'data',
                    data: data,
                    peer: self
                }));
            })
            .on('error', function(err) {
                console.log('error in connection', id, err);
                subscriber(new Bacon.Error(err));
            })
            .on('close', function() {
                console.log('connection closed', id);
                subscriber(new Bacon.Next({
                    type: 'close',
                    peer: self
                }));
                subscriber(new Bacon.End());
            });

            broker.events.onError(function(err) {
                // TODO: is this a hack or what?
                if (err.message && err.message.indexOf(id) >= 0) {
                    console.log('failed to connect to', id);
                    subscriber(new Bacon.Error(err));
                }
            });

            return function unsubscribe() {
                conn.close();  // TODO: This triggers a 'close' event, right?
            };
        });

        function onReady() {
            return  when.promise(function(resolve, reject) {
                stream.onValue(function(v) {
                    if (v.type === 'open') {
                        resolve(self);
                        return Bacon.noMore;
                    }
                });
                stream.onError(function(err) {
                    reject(err);
                    return Bacon.noMore;
                });
            });
        }

        function send(data) {
            return conn.send(data);
        }

        return _.assign(self, {
            id:      conn.peer,
            host:    broker.info.host,
            port:    broker.info.port,
            conn:    conn,
            events:  stream,
            onReady: onReady,
            send:    send
        });
    }

    return Peer;
});
