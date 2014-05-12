import BrokerPool           from './broker_pool'
import PeerConnection       from './peer_connection'
import { data, match }      from './functional_utils'
import { compose, partial } from 'lodash'
import { never }            from 'Bacon'
import { bind, constant, flatMap, map, pure, lift } from 'bilby'
import StateT                  from 'stateT'
import mori                    from 'mori'
import {
    assoc,
    dissoc,
    hash_map,
    has_key,
    keys,
    into_array,
    vector,
    set,
    union,
    difference
} from 'mori'

export {
    InputEvent,
    create
}

/** event types **/

var InputEvent = data({
    connectTo:      ['peerInfo'],
    disconnectFrom: ['peer'],
    brokerEvent:    ['event']
})

/** implementation **/

function create(idSelf, inputs, createBrokerPool = defaultBrokerPool) {
    var brokerInputs    = translateInputs(inputs)
    var brokerPool      = createBrokerPool(idSelf, brokerEvents)
    var [conns, events] = connsPropertyAndEvents(
        brokerPool,
        connsEventsWithState(idSelf, inputs)
    )
    return Object.freeze({
        connections: conns,
        events: events
    })
}

function defaultBrokerPool(idSelf, inputs) {
    return compose(
        partial(BrokerPool.removeUnused, [primary], 30000),
        BrokerPool.removeOnClose
    )(BrokerPool.create(idSelf, brokerInputs))
}

function translateInputs(inputs) {
    return inputs.flatMap(match(InputEvent, {
        connectTo:      peerInfo => BrokerPool.InputEvent.connectTo(getBrokerInfo(peerInfo)),
        disconnectFrom: peer     => never(),  // Nothing to do from the broker pool side.
        brokerEvent:    event    => event
    }))
}

var get    = bind(StateT.get)(Bacon)
var put    = bind(StateT.put)(Bacon)
var modify = bind(StateT.modify)(Bacon)
var pure   = bind(StateT.pure)([StateT.StateT, Bacon])
function sequence_(...actions) {
    if (actions.length <= 1) {
        return actions[0];
    }
    else {
        return flatMap(actions[0], constant(sequence_(actions.slice(1))));
    }
}

function connsPropertyAndEvents(brokerPool, eventsWithState) {
    var initState = Object.freeze({
        brokerPool: brokerPool,
        connections: hash_map()
    })
    var combined = StateT.runStateT(eventsWithState, initState)
    return [
        combined.map('.state').toProperty(hash_map()),
        combined.map('.value')
    ]
}

function connsEventsWithState(idSelf, inputs) {
    flatMap(lift(StateT, inputs), match(InputEvent, {
        connectTo: connectToPeer
        disconnect: disconnectFrom => undefined,
        brokerEvent: event => undefined
    }))
}

var connectToPeer = peerInfo => get().flatMap(
    ({brokerPool}) => getBrokerInfo(peerInfo)
)

// TODO: Can this be idempotent?
function connectToPeer(brokers, peerInfo) {
    var brokerInfo = getBrokerInfo(peerInfo)
    return brokers
    .filter(
        bs => BrokerPool.has(bs, brokerInfo)
    )
    .take(1)
    .flatMap(bs => {
        var broker = BrokerPool.get(bs, brokerInfo)
        var conn   = PeerConnection.create(broker, peerInfo)
        return conn.events
    })
}

function getBrokerInfo(peerInfo) {
    // TODO
    return peerInfo
}
