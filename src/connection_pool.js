import BrokerPool           from './broker_pool';
import PeerConnection       from './peer_connection';
import { data, match }      from './functional_utils';
import { compose, partial } from 'lodash';
import { never }            from 'Bacon';

export {
    InputEvent,
    create
};

/** event types **/

var InputEvent = data({
    connectTo:      ['peerInfo'],
    disconnectFrom: ['peer'],
    brokerEvent:    ['event']
});

/** implementation **/

function create(idSelf, inputs) {
    var brokerInputs = translateInputs(inputs);

    var brokerPool = compose(
        partial(BrokerPool.removeUnused, [primary], 30000),
        BrokerPool.removeOnClose
    )(BrokerPool.create(idSelf, brokerInputs));

    var events = peerEvents(idSelf, brokerPool);
    return Object.freeze({
        events: events
    });
}

function translateInputs(inputs) {
    return inputs.flatMap(match(InputEvent, {
        connectTo:      peerInfo => BrokerPool.InputEvent.connectTo(getBrokerInfo(peerInfo)),
        disconnectFrom: peer     => never(),  // Nothing to do from the broker pool side.
        brokerEvent:    event    => event
    }));
}

function peerEvents(idSelf, brokers, inputs) {
    return inputs.flatMap(match(InputEvent, {
        connectTo: peerInfo => connectToPeer(brokers, peerInfo),

        // return brokers.take(1).flatMap(function(bs) {
        //     return connectToPeer(bs, peerInfo);
        // });

        disconnectFrom: peer => { /* TODO */ }
    }));
}

// TODO: Can this be idempotent?
function connectToPeer(brokers, peerInfo) {
    var brokerInfo = getBrokerInfo(peerInfo);
    return brokers
    .filter(
        bs => BrokerPool.has(bs, brokerInfo)
    )
    .take(1)
    .flatMap(bs => {
        var broker = BrokerPool.get(bs, brokerInfo);
        var conn   = PeerConnection.create(broker, peerInfo);
        return conn.events;
    });
}

function getBrokerInfo(peerInfo) {
    // TODO
    return peerInfo;
}
