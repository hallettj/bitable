define('bitstar/broker_pool', [
    './broker',
    'when/when',
    'Bacon',
    'mori'
], function(Broker, when, Bacon, mori) {
    'use strict';

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

    return Pool;
});
