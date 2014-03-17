import { data }     from './functional_utils';
import PeerJs       from 'peerjs';
import Bacon        from 'Bacon';
import { assign }   from 'lodash';
import { EventStream, Next } from 'Bacon';

export {
    Event,
    connect,
    disconnect
};

var Event = data({
    connection: ['peer', 'broker'],
    open:       ['broker'],
    close:      ['broker']
});

function connect(idSelf, options) {
    var broker = new PeerJs(idSelf, options);
    var res    = {
        conn: broker
    };
    res.events = events(res);
    assign(res, options);
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
    var evts = new EventStream(subscriber => {
        subscriber(new Next(() => Event.connection(broker)));

        conn.on('connection', conn => {
            subscriber(new Next(() => Event.peerConnection(broker, conn)));
        });
        conn.on('open', () => {
            subscriber(new Next(() => Event.open(broker)));
        });
        conn.on('error', err => {
            subscriber(new Bacon.Error(err));
        });
        conn.on('close', () => {
            subscriber(new Next(() => Event.close(broker)));
            subscriber(new Bacon.End());
        });
        return function unsubscribe() {
            conn.disconnect();
        };
    }).endOnError();
    return evts;
}
