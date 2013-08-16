/*globals require */

require.config({
    baseUrl: '/',
    paths: {
        'bitstar': 'src',
        'when': 'node_modules/when',
        //'when': 'node_modules/when/when',
        //'when/timed': 'node_modules/when/timed',
        'lodash': 'node_modules/lodash/dist/lodash',
        'Bacon': 'node_modules/baconjs/dist/Bacon',
        'peerjs': 'node_modules/peerjs/dist/peer',
        'bencode-js': 'node_modules/bencode-js/bencode',
        'stringview': 'lib/stringview',
        'jquery': 'lib/jquery/jquery'
    },
    shim: {
        'bencode-js': {
            exports: 'Bencode'
        },
        'peerjs': {
            exports: 'Peer'
        }
    },
    enforceDefine: true
});

require([
    'bitstar/dht',
    'bitstar/id',
    'when/when',
    'when/timed',
    'jquery',
    'lodash'
], function(DHT, Id, when, t, $, _) {
    'use strict';

    var id = param('id') || Id.random();
    var bootstrapId = param('bootstrap');
    var name = "anon";

    var self = {
        id: id,
        host: 'zinc.sitr.us',
        port: 9000
    };
    var dht = new DHT({
        id: id,
        brokerInfo: { host: 'zinc.sitr.us', port: 9000 }
    });

    (function syncStats() {
        var connects = dht.connectEvents;
        var disconnects = dht.closeEvents;
        var connectionEvents = connects.merge(disconnects);

        connectionEvents.onValue(function() {
            var count = dht.routeTable.getNodes().length;
            $('#stats .nodeId').text(self.id);
            $('#stats .peerCount').text(count);
        });
    }());

    var broadcasts = [];

    $('#getName').on('submit', function(event) {
        event.preventDefault();
        $(this).find(':input[name="name"]').each(function() {
            name = this.value;
        });
        $(this).remove();
    });

    $('#upload').on('submit', function(event) {
        event.preventDefault();
        var files = $(this).find(':file').get(0).files;
        for (var i = 0; i < files.length; i += 1) {
            blobToUri(files[i]).then(broadcast).then(compl, $.noop, prog);
        }
        function compl() {
            $('#sending').hide();
        }
        // TODO: individual progress indicator for each file
        function prog(progress) {
            $('#sending').toggle(progress < 1).text(
                'sending: '+ Math.floor(progress * 100) +'%'
            );
        }
    });

    $('.joinLink').prop('href', makeJoinLink());

    dht.messages.onValue(function(incoming) {
        var msg     = incoming[0]
          , respond = incoming[1]
          , params  = msg.a
          , token   = msg && msg.a && params.token;
        if (msg.q === 'broadcast' && token) {
            if (!broadcasts[token]) {
                params.chunks = new Array(params.len);
                params.received = 0;
                params.start = new Date();
                broadcasts[token] = params;
            }
            else {
                params = broadcasts[token];
            }
            if (typeof params.chunks[msg.a.i] === 'undefined') {
                params.chunks[msg.a.i] = msg.a.chunk;
                params.received += 1;

                rebroadcast(msg.a, respond);

                if (params.received === params.len) {
                    params.data = params.chunks.join('');
                    onbroadcast(params);
                }
            }
            else {
                refuseBroadcast(msg.a, respond);
            }
        }
    });

    function onbroadcast(params) {
        $('#posts').prepend(
            $('<img/>')
                .prop('src', params.data)
                .prop('title', 'posted by '+ params.by +' ('+ params.origin +')')
        );
        $('#posts > *').slice(10).remove();  // limit to 10 posts
    }

    function broadcast(msg) {
        var deferred = when.defer();
        var chunks = inChunks(msg, 500);
        var peers  = [];
        var params = {
            id: self.id,
            by: name,
            origin: self.id,
            token: Id.random(),
            len: chunks.length
        };

        dht.routeTable.getBuckets().forEach(function(bucket) {
            peers.push.apply(peers, bucket.slice(0, 3));
        });

        var maxRetries = 10, progress = 0;

        peers.forEach(function(peer) {
            (function broadcast_(i, retries) {
                var resp = dht.query(peer, 'broadcast', _.assign({
                    i: i,
                    chunk: chunks[i]
                }, params));

                t.timeout(500, resp).then(function(r) {
                    var p;
                    if (r.r && r.r.p === 'yes') {
                        if (i + 1 < chunks.length) {
                            p = (i + 1) / chunks.length;
                            if (p > progress) {
                                deferred.notify(p);
                                progress = p;
                            }
                            broadcast_(i + 1, maxRetries);
                        }
                        else {
                            deferred.resolve();
                        }
                    }
                }, function() {
                    if (retries > 0) {
                        setTimeout(function() {
                            broadcast_(i, retries - 1);
                        }, Math.pow(2, maxRetries - retries));
                    }
                    else {
                        // TODO: reject if broadcast to all peers
                        // failed?
                        //deferred.reject();
                    }
                });

            }(0, maxRetries));
        });

        onbroadcast(_.assign({
            data: msg
        }, params));

        return deferred.promise;
    }

    // TODO: need to apply retries to rebroadcast
    function rebroadcast(params, respond) {
        var from = params.id;
        respond({
            id: self.id,
            token: params.token,
            i: params.i,
            p: 'yes'
        });
        dht.routeTable.getNodes().filter(function(node) {
            return Id.compare(Id.dist(node.id, self.id), Id.dist(node.id, from)) < 0;
        }).forEach(function(node) {
            dht.query(node, 'broadcast', {
                id: self.id,
                by: params.by,
                origin: params.origin,
                token: params.token,
                len: params.len,
                i: params.i,
                chunk: params.chunk
            });
        });
    }

    function refuseBroadcast(params, respond) {
        respond({
            id: self.id,
            token: params.token,
            i: params.i,
            p: 'no'
        });
    }

    function inChunks(msg, chunkSize) {
        var chunks = [];
        while (msg.length > chunkSize) {
            chunks.push(msg.slice(0, chunkSize));
            msg = msg.slice(chunkSize);
        }
        if (msg.length > 0) {
            chunks.push(msg);
        }
        return chunks;
    }

    function blobToUri(file) {
        return when.promise(function(resolve) {
            var reader = new FileReader();
            reader.onload = function(event) {
                var uri = event.target.result;
                resolve(uri);
            };
            reader.readAsDataURL(file);
        });
    }

    function makeJoinLink() {
        var base = window.location.href.split('?')[0];
        return base + '?bootstrap='+ self.id;
    }

    // cleanup buffered data
    setInterval(function() {
        var cutoff = new Date() - 600000;
        Object.keys(broadcasts).forEach(function(token) {
            if (broadcasts[token].start < cutoff) {
                delete broadcasts[token];
            }
        });
    }, 600000);

    console.log('ready', self.id, self);

    if (bootstrapId) {
        dht.bootstrap([{
            id: bootstrapId,
            host: "zinc.sitr.us",
            port: 9000
        }]);
    }

    dht.connectEvents.onValue(function(peer) {
        var msg = "connected to "+ peer.id;
        console.log('connection', peer.id, peer);
    });

    dht.closeEvents.onValue(function(id) {
        var msg = "lost connection to"+ id;
        console.log('lost connection', id);
    });

    dht.messages.onError(function(err) {
        console.error(err);
    });

    function param(key) {
        var exp = new RegExp('\\b'+ key +'=([^&=]+)');
        var matches = exp.exec(window.location);
        return matches && matches[1];
    }

    window.self = self;
    window.dht  = dht;
});
