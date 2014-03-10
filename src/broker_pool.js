define('bitstar/broker_pool', [
    './broker',
    './peer',
    './functional_utils',
    'when/when',
    'Bacon',
    'mori'
], function(Broker, Peer, F, when, Bacon, mori) {
    'use strict';

    /** event types **/

    var InputEvent = F.data({
        connectTo:      ['brokerInfo'],
        disconnectFrom: ['broker']
    });

    /** implementation **/

    // TODO: Automatically disconnect from brokers that have not been
    // used recently.

    // type BrokerPool = {
    //     brokers: Bacon.Property<mori.hash_map<BrokerKey, Broker>>,
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

    // :: (mori.hash_map<BrokerKey, Broker>, brokerInfo) -> (Broker | falsy)
    function getBroker(brokers, brokerInfo) {
        var key = keyFor(brokerInfo);
        return mori.get(brokers, key);
    }

    // :: (mori.hash_map<BrokerKey, Broker>, brokerInfo) -> boolean
    function hasBroker(brokers, brokerInfo) {
        var key = keyFor(brokerInfo);
        return mori.has_key(brokers, key);
    }

    // Modifies a pool to remove brokers from the pool when a 'close'
    // event is received.  Without this behavior broker connections that
    // are closed from the remote side will remain in the pool, despite
    // being unusable.
    //
    // :: BrokerPool -> BrokerPool
    function removeOnClose(pool) {
        var closeEvents = pool.events.filter(function(event) {
            return event.constructor === Broker.Event.close;
        }).map(function(event) {
            return Change.removed(event.broker);
        });
        var allChanges = Bacon.mergeAll(changes(pool.brokers), closeEvents);
        var brokers_ = allChanges.scan(mori.hash_map(), function(brokers, event) {
            return F.match(Change, {
                added: function(broker) {
                    return mori.assoc(brokers, keyFor(broker), broker);
                },
                removed: function(broker) {
                    return mori.dissoc(brokers, keyFor(broker));
                }
            })(event);
        });
        return F.modify(pool, 'brokers', brokers_);
    }

    // Modifies a pool to remove brokers that have not been used in
    // a given time interval.  Exceptions are mode for a given list
    // brokers.
    //
    // :: (BrokerPool, [brokerInfo], number) -> BrokerPool
    function removeUnused(exceptions, timeout, pool) {
        var lastUsed = pool.events.scan(mori.hash_map, function(m, event) {
            var broker = event.broker;
            var key    = keyFor(broker);
            var now    = new Date();
            var last   = mori.get(m, key);
            if (event.constructor === Broker.Event.close) {
                return mori.dissoc(m, key);
            }
            else {
                if (now - last > timeout) {
                    // TODO: slightly hacky
                    Broker.disconnect(broker);
                }
                return mori.assoc(m, key, now);
            }
        });
        return F.modify(pool, 'lastUsed', lastUsed);
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

    // :: (bitstar/id, Bacon.EventStream<InputEvent>) -> Bacon.Property<mori.hash_map<BrokerKey, Broker>>
    function brokersProperty(idSelf, inputs) {
        return inputs.scan(mori.hash_map(), function(brokers, event) {
            return F.match(InputEvent, {
                connectTo: function(brokerInfo) {
                    var key, broker;
                    if (hasBroker(brokers, brokerInfo)) {
                        return brokers;
                    }
                    else {
                        key    = keyFor(brokerInfo);
                        broker = Broker.connect(idSelf, brokerInfo);
                        return mori.assoc(brokers, key, broker);
                    }
                },
                disconnectFrom: function(broker) {
                    var key = keyFor(broker);  // TODO: broker vs. brokerInfo
                    Broker.disconnect(broker);
                    return mori.dissoc(brokers, key);
                }
            })(event);
        });
    }

    // :: Bacon.Property<mori.hash_map<BrokerKey, Broker>> -> Bacon.EventStream<Broker.Event>
    function brokerEvents(brokersProp) {
        return added(brokersProp).flatMap(function(broker) {
            return broker.events;
        });
    }

    // Emits an event when a broker is added to the underlying brokers
    // property.
    //
    // :: Bacon.Property<mori.hash_map<BrokerKey, Broker>> -> Bacon.EventStream<Broker>
    function added(brokersProp) {
        return changes(brokersProp).filter(function(event) {
            return event.constructor === Change.added;
        }).map('.broker');
    }

    // Emits an event when a broker is removed from the underlying brokers
    // property.
    //
    // :: Bacon.Property<mori.hash_map<BrokerKey, Broker>> -> Bacon.EventStream<Broker>
    function removed(brokersProp) {
        return changes(brokersProp).filter(function(event) {
            return event.constructor === Change.removed;
        }).map('.broker');
    }

    var Change = F.data({
        added:   ['broker'],
        removed: ['broker']
    });

    // Emits an event when a broker is removed from the underlying brokers
    // property.
    //
    // :: Bacon.Property<mori.hash_map<BrokerKey, Broker>> -> Bacon.EventStream<Change>
    function changes(brokersProp) {
        return brokersProp.changes().scan(mori.hash_map(), function(prev, brokers) {
            var prevKeys    = mori.set(mori.keys(prev));
            var newKeys     = mori.set(mori.keys(brokers));
            var allKeys     = mori.union(prevKeys, newKeys);
            var addedKeys   = mori.difference(allKeys, prevKeys);
            var removedKeys = mori.difference(allKeys, newKeys);
            return Object.freeze({
                added:   getBrokers(brokers, addedKeys),
                removed: getBrokers(prev,    removedKeys)
            });
            function getBrokers(bs, keys) {
                return mori.into_array(mori.map(function(key) {
                    return mori.get(bs, key);
                }, keys));
            }
        })
        .flatMap(function(cs) {
            var addEvents = cs.added.map(Change.added);
            var remEvents = cs.removed.map(Change.removed);
            return Bacon.fromArray(addEvents.concat(remEvents));
        });
    }

    // :: brokerInfo -> BrokerKey
    function keyFor(brokerInfo) {
        return mori.vector(brokerInfo.host, brokerInfo.port);
    }

    return {
        InputEvent:    InputEvent,
        create:        create,
        removeOnClose: removeOnClose,
        removeUnused:  removeUnused,
        get:           getBroker,
        has:           hasBroker
    };
});
