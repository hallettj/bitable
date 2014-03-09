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

    var InputEvents = F.data({
        connectTo: function(brokerInfo) {
            return {
                brokerInfo: brokerInfo
            };
        },
        disconnectFrom: function(broker) {
            return {
                broker: broker
            };
        }
    });

    /** implementation **/

    // TODO: Automatically disconnect from brokers that have not been
    // used recently.

    function create(idSelf, inputs) {
        var bEvents = brokerEvents(idSelf, inputs);
        return Object.freeze({
            idSelf:  idSelf,
            brokers: mori.hash_map(),
            events:  bEvents
        });
    }

    // :: (bitstar/broker_pool, brokerInfo) -> bitstar/broker
    function connect(pool, brokerInfo) {
        var key     = keyFor(brokerInfo);
        var brokers = pool.brokers;
        if (mori.has_key(brokers, key)) {
            return pool;
        }
        else {
            var broker  = Broker.connect(pool.idSelf, brokerInfo);
            var promise = when.promise(function(resolve, reject) {
                broker.events.onEnd(reject);
                broker.onValue('open', function() {
                    resolve(broker);
                });
            });
            return F.modify(pool, 'brokers', mori.assoc(brokers, key, promise));
        }

    }

    // :: (mori.vector, peerInfo) -> broker
    function getBroker(brokers, peerInfo) {
        var key = keyFor(peerInfo);  // TODO: Does peerInfo have superset of properties of brokerInfo?
        return mori.get(brokers, key);
    }

    function hasBroker(brokers, peerInfo) {
        var key = keyFor(peerInfo);  // TODO: Does peerInfo have superset of properties of brokerInfo?
        return mori.has_key(brokers, key);
    }

    function brokersProperty(idSelf, brokerEvents) {
        return brokerEvents.scan(mori.hash_map(), function(brokers, event) {
            return F.match(Broker.Events, {
                brokerConnection: function(broker) {
                    var key = keyFor(broker);
                    return mori.assoc(brokers, key, broker);
                },
                close: function(broker) {
                    var key = keyFor(broker);
                    return mori.dissoc(brokers, key);
                },
                _: function() {
                    return brokers;
                }
            })(event);
        });
    }

    function brokerEvents(idSelf, inputs) {
        return inputs.flatMap(F.match(InputEvents, {
            // TODO: Can this be idempotent?
            connectTo: function(brokerInfo) {
                var broker = Broker.connect(idSelf, brokerInfo);
                return broker.events;
            },

            // TODO: This is ugly.
            disconnectFrom: function(broker) {
                Broker.disconnect(broker);
                return Bacon.never();
            }
        }));
    }

    function Pool(idSelf, opts) {
        var brokers       = mori.hash_map();
        var events        = new Bacon.Bus();
        var brokerTimeout = (opts && opts.keepOpen) || 30000;

        function connect(brokerInfo) {
            var key = keyFor(brokerInfo);
            return mori.get(brokers, key) || connect_(brokerInfo, key, true);
        }

        function withBroker(brokerInfo, fn) {
            var key = keyFor(brokerInfo);
            var broker = mori.get(brokers, key) || connect_(brokerInfo, key);
            return when.promise(function(resolve, reject, notify) {
                broker.events.onEnd(reject);
                fn(broker).then(resolve, reject, notify);
            });
        }

        function connect_(brokerInfo, key, keepOpen) {
            var broker = new Broker(idSelf, brokerInfo), timeout;
            events.plug(broker.events);
            brokers = mori.assoc(brokers, key, broker);

            broker.events.onEnd(function() {
                if (mori.get(brokers, key) === broker) {
                    brokers = mori.dissoc(brokers, key);
                }
            });

            if (!keepOpen) {
                disconnect();
                broker.events.onValue(function(v) {
                    if (v.type === 'connection') {
                        disconnect();
                    }
                });
            }

            function disconnect() {
                clearTimeout(timeout);
                timeout = setTimeout(broker.disconnect, brokerTimeout);
            }

            return broker;
        }

        return {
            connect:    connect,
            withBroker: withBroker,
            events:     events
        };
    }

    function keyFor(brokerInfo) {
        return mori.vector(brokerInfo.host, brokerInfo.port);
    }

    return {
        InputEvents: InputEvents,
        create:      create,
        get:         getBroker,
        has:         hasBroker
    };
});
