/**
 * when: https://github.com/cujojs/when
 */

// TODO: maybe rename this to /messageHandler or something
define('kademlia/bus', ['peerjs', 'when', 'bacon'], function(peerjs, when, Bacon) {

    function Bus(id, brokerInfo) {
        var peer = new peerjs.Peer(id, brokerInfo)
          , connections = {};

        peer.on('connection', function(conn) {
            connections[conn.peer.id] = conn;  // TODO: clean up previous connection
            conn.on('data', function(data) {
                react(data);
            });
        });

        function connect(otherId, brokerInfo) {
            return getBroker(brokerInfo).then(function(peer) {
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

        function getBroker(brokerInfo) {
            // TODO: reuse broker connections where possible
            return when.resolve(
                new peerjs.Peer(id, brokerInfo);
            );
        }

        function send(recipient, msgType, payload) {
            getConnection(recipient).then(function(conn) {
                conn.send({ type: msgType, payload: payload });
            });
        }

        function getConnection(id) {
            return when.resolve(connections[id]);
            // TODO: connect to peer if not already connected
            // TODO: this should go through routing table?
        }

        return {
            connect: connect
        };
    }

    function react(msg) {
        if (msg.type === 'ping') {
            // TODO
        }
        // TODO
    };

});
