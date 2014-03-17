import Bacon                              from 'Bacon';
import { EventStream, End, Next, noMore } from 'Bacon';
import { promise }                        from 'when/when';
import { assign }                         from 'lodash';

export default Peer;

function Peer(broker, conn, opts) {
    var self = {};
    var id = conn.peer;
    var timeout = (opts && opts.timeout) || 1000;
    var openEvent = new Next({
        type: 'open',
        peer: self,
    });

    var stream = new EventStream(subscriber => {
        var t;
        if (conn.open) {
            console.log('connection already open', id);
            subscriber(openEvent);
        }
        else {
            conn.on('open', () => {
                console.log('connection open', id);
                subscriber(openEvent);
                clearTimeout(t);
            });
            if (timeout > 0) {
                t = setTimeout(() => {
                    subscriber(new Bacon.Error('timeout connecting to '+ id));
                }, timeout);
            }
        }
        conn
        .on('data', data => {
            subscriber(new Next({
                type: 'data',
                data: data,
                peer: self
            }));
        })
        .on('error', err => {
            console.log('error in connection', id, err);
            subscriber(new Bacon.Error(err));
        })
        .on('close', () => {
            console.log('connection closed', id);
            subscriber(new Next({
                type: 'close',
                peer: self
            }));
            subscriber(new End());
        });

        broker.events.onError(err => {
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
        return promise((resolve, reject) => {
            stream.onValue(v => {
                if (v.type === 'open') {
                    resolve(self);
                    return noMore;
                }
            });
            stream.onError(err => {
                reject(err);
                return noMore;
            });
        });
    }

    function send(data) {
        return conn.send(data);
    }

    return assign(self, {
        id:      conn.peer,
        host:    broker.info.host,
        port:    broker.info.port,
        conn:    conn,
        events:  stream,
        onReady: onReady,
        send:    send
    });
}
