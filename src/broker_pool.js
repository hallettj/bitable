import Broker                  from './broker';
import { data, match, modify } from './functional_utils';
import { fromArray, mergeAll } from 'Bacon';
import mori                    from 'mori';
import {
    assoc,
    dissoc,
    hash_map,
    has_key,
    keys,
    into_array,
    map,
    vector,
    set,
    union,
    difference
} from 'mori';

export {
    InputEvent,
    create,
    removeOnClose,
    removeUnused,
    get,
    has
};

/** event types **/

var InputEvent = data({
    connectTo:      ['brokerInfo'],
    disconnectFrom: ['broker']
});

var Change = data({
    added:   ['broker'],
    removed: ['broker']
});

/** implementation **/

// TODO: Automatically disconnect from brokers that have not been
// used recently.

// type BrokerPool = {
//     brokers: Bacon.Property<hash_map<BrokerKey, Broker>>,
//     events:  Bacon.EventStream<Broker.Event>
// }

// :: (bitstar/id.Id, Bacon.EventStream<InputEvent>) -> BrokerPool
function create(idSelf, inputs) {
    var brokers = brokersProperty(idSelf, inputs);
    var events  = brokerEvents(brokers);
    return Object.freeze({
        brokers: brokers,
        events:  events
    });
}

// :: (hash_map<BrokerKey, Broker>, brokerInfo) -> (Broker | falsy)
function get(brokers, brokerInfo) {
    var key = keyFor(brokerInfo);
    return mori.get(brokers, key);
}

// :: (hash_map<BrokerKey, Broker>, brokerInfo) -> boolean
function has(brokers, brokerInfo) {
    var key = keyFor(brokerInfo);
    return has_key(brokers, key);
}

// Modifies a pool to remove brokers from the pool when a 'close'
// event is received.  Without this behavior broker connections that
// are closed from the remote side will remain in the pool, despite
// being unusable.
//
// :: BrokerPool -> BrokerPool
function removeOnClose(pool) {
    var closeEvents = pool.events.filter(
        event => event.constructor === Broker.Event.close
    ).map(
        event => Change.removed(event.broker)
    );
    var allChanges = mergeAll(changes(pool.brokers), closeEvents);
    var brokers_ = allChanges.scan(hash_map(), (brokers, event) => match(Change, {
        added: function(broker) {
            return assoc(brokers, keyFor(broker), broker);
        },
        removed: function(broker) {
            return dissoc(brokers, keyFor(broker));
        }
    })(event));
    return modify(pool, 'brokers', brokers_);
}

// Modifies a pool to remove brokers that have not been used in
// a given time interval.  Exceptions are mode for a given list
// brokers.
//
// :: (BrokerPool, [brokerInfo], number) -> BrokerPool
function removeUnused(exceptions, timeout, pool) {
    var lastUsed = pool.events.scan(hash_map, (m, event) => {
        var broker = event.broker;
        var key    = keyFor(broker);
        var now    = new Date();
        var last   = mori.get(m, key);
        if (event.constructor === Broker.Event.close) {
            return dissoc(m, key);
        }
        else {
            if (now - last > timeout) {
                // TODO: slightly hacky
                Broker.disconnect(broker);
            }
            return assoc(m, key, now);
        }
    });
    return modify(pool, 'lastUsed', lastUsed);
}

// // TODO: maybe this format?
// function removeUnused(exceptions, timeout) {
//     return function(inputs, next) {
//         var inputs_ = [modify inputs somehow];
//         var pool    = next(inputs_);
//         var pool_   = [modify pool somehow];
//         return pool_;
//     };
// }

// :: (bitstar/id, Bacon.EventStream<InputEvent>) -> Bacon.Property<hash_map<BrokerKey, Broker>>
function brokersProperty(idSelf, inputs) {
    return inputs.scan(hash_map(), (brokers, event) => match(InputEvent, {
        connectTo: brokerInfo => {
            var key, broker;
            if (has(brokers, brokerInfo)) {
                return brokers;
            }
            else {
                key    = keyFor(brokerInfo);
                broker = Broker.connect(idSelf, brokerInfo);
                return assoc(brokers, key, broker);
            }
        },
        disconnectFrom: broker => {
            var key = keyFor(broker);  // TODO: broker vs. brokerInfo
            Broker.disconnect(broker);
            return dissoc(brokers, key);
        }
    })(event));
}

// :: Bacon.Property<hash_map<BrokerKey, Broker>> -> Bacon.EventStream<Broker.Event>
function brokerEvents(brokersProp) {
    return added(brokersProp).flatMap(broker => broker.events);
}

// Emits an event when a broker is added to the underlying brokers
// property.
//
// :: Bacon.Property<hash_map<BrokerKey, Broker>> -> Bacon.EventStream<Broker>
function added(brokersProp) {
    return changes(brokersProp).filter(
        event => event.constructor === Change.added
    ).map('.broker');
}

// Emits an event when a broker is removed from the underlying brokers
// property.
//
// :: Bacon.Property<hash_map<BrokerKey, Broker>> -> Bacon.EventStream<Broker>
function removed(brokersProp) {
    return changes(brokersProp).filter(
        event => event.constructor === Change.removed
    ).map('.broker');
}

// Emits an event when a broker is removed from the underlying brokers
// property.
//
// :: Bacon.Property<hash_map<BrokerKey, Broker>> -> Bacon.EventStream<Change>
function changes(brokersProp) {
    return brokersProp.changes().scan(hash_map(), (prev, brokers) => {
        var prevKeys    = set(keys(prev));
        var newKeys     = set(keys(brokers));
        var allKeys     = union(prevKeys, newKeys);
        var addedKeys   = difference(allKeys, prevKeys);
        var removedKeys = difference(allKeys, newKeys);
        return Object.freeze({
            added:   getBrokers(brokers, addedKeys),
            removed: getBrokers(prev,    removedKeys)
        });
        function getBrokers(bs, keys) {
            return into_array(map(key => mori.get(bs, key), keys));
        }
    })
    .flatMap(cs => {
        var addEvents = cs.added.map(Change.added);
        var remEvents = cs.removed.map(Change.removed);
        return fromArray(addEvents.concat(remEvents));
    });
}

// :: brokerInfo -> BrokerKey
function keyFor(brokerInfo) {
    return vector(brokerInfo.host, brokerInfo.port);
}
