/**
 * when: https://github.com/cujojs/when
 */

define('kademlia/bus', ['peerjs', 'when', 'bacon'], function(peerjs, when, Bacon) {

    function Bus(id, brokerInfo) {
        var peer = new peerjs.Peer(id, brokerInfo)
          , connections = {};

        peer.on('connection', function(conn) {
            connections[conn.peer.id] = conn;  // TODO: clean up previous connection?
            conn.on('data', function(data) {
                react(conn, data);
            });
        });

        function connect(otherId, brokerInfo) {
            return withBroker(brokerInfo, function(peer) {
                return when.promise(function(resolve, reject) {
                    var conn = peer.connect(otherId, {
                        reliable: false
                    });
                    conn.on('open', function() {
                        connections[otherId] = conn;
                        resolve(conn);
                    });
                    conn.on('error', reject);
                });
            });
        }

        function disconnect(otherId) {
            getConnection(otherId).then(function(conn) {
                if (connections[otherId] === conn) {
                    delete connections[otherId];
                }
                conn.close();
            });
        }

        function getConnection(id) {
            return when.resolve(connections[id]);
            // TODO: connect to peer if not already connected
            // TODO: this should go through routing table?
        }

        // TODO: reuse broker connections where convenient
        function withBroker(brokerInfo, fn) {
            return when.promise(function(resolve, reject, notify) {
                var peer = new peerjs.Peer(id, brokerInfo);
                peer.on('error', reject);

                var promise = fn(peer);
                promise.then(resolve, reject, notify);
                promise.ensure(function() {
                    peer.disconnect();
                });
            });
        }

        function send(recipient, msgType, payload) {
            getConnection(recipient).then(function(conn) {
                conn.send({ type: msgType, payload: payload });
            });
        }

        return {
            connect:    connect,
            disconnect: disconnect
        };
    }

    function react(conn, msg) {
        if (msg.y === 'q' && msg.q === 'ping') {
            sendPong(conn, msg);
        }
    };

    // TODO: message formats may represent enough logic for another
    // module
    function sendPong(conn, msg) {
        if (msg.a && msg.a.id && msg.t) {
            conn.send({
                t: msg.t,
                y: 'r',
                r: { id: selfId }
            });
        }
    };

});
