define('kademlia/peer', ['peerjs'], function(peerjs) {

    function Peer(id, brokerInfo) {
        var peer = new peerjs.Peer(id, brokerInfo)
          , connections = [];

        peer.on('connection', function(conn) {
            connections.push[conn];
            conn.on('data', function(data) {
                react(data);
            });
        });
    }

    function react(msg) {
        if (msg.type === 'ping') {
            // TODO
        }
        // TODO
    };

});
