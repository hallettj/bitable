define('bitstar/connection_pool', [
    './broker_pool',
    './peer_connection',
    './message',
    './functional_utils',
    'lodash',
    'peerjs',
    'when/when',
    'when/timed',
    'Bacon'
], function(BrokerPool, PeerConnection, M, F, _, Peer, when, t, Bacon) {
    'use strict';

    /** event types **/

    var InputEvent = F.data({
        connectTo:      ['peerInfo'],
        disconnectFrom: ['peer'],
        brokerEvent:    ['event']
    });

    /** implementation **/

    function create(idSelf, inputs) {
        var brokerInputs = translateInputs(inputs);

        var brokerPool = _.compose(
            _.partial(BrokerPool.removeUnused, [primary], 30000),
            BrokerPool.removeOnClose
        )(BrokerPool.create(idSelf, brokerInputs));

        var events       = peerEvents(idSelf, brokerPool);
        return Object.freeze({
            events: events
        });
    }

    function translateInputs(inputs) {
        return inputs.flatMap(F.match(InputEvent, {
            connectTo: function(peerInfo) {
                return BrokerPool.InputEvents.connectTo(
                    getBrokerInfo(peerInfo)
                );
            },
            disconnectFrom: function(peer) {
                // Nothing to do from the broker pool side.
                return Bacon.never();
            },
            brokerEvent: function(event) {
                return event;
            }
        }));
    }

    function peerEvents(idSelf, brokers, inputs) {
        return inputs.flatMap(F.match(InputEvent, {
            connectTo: function(peerInfo) {
                return connectToPeer(brokers, peerInfo);

                // return brokers.take(1).flatMap(function(bs) {
                //     return connectToPeer(bs, peerInfo);
                // });
            },
            disconnectFrom: function(peer) {
            }
        }));
            
    }

    // TODO: Can this be idempotent?
    function connectToPeer(brokers, peerInfo) {
        var brokerInfo = getBrokerInfo(peerInfo);
        return brokers
        .filter(function(bs) {
            return BrokerPool.has(bs, brokerInfo);
        })
        .take(1)
        .flatMap(function(bs) {
            var broker = BrokerPool.get(bs, brokerInfo);
            var conn   = PeerConnection.create(broker, peerInfo);
            return conn.events;
        });
    }

    function getBrokerInfo(peerInfo) {
        // TODO
        return peerInfo;
    }

    return {
        create: create
    };
});
