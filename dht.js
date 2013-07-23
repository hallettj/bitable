define('kademlia/dht', ['./id'], function(Id) {
    'use strict';

    function DHT(opts) {
        opts = extend({}, defaults, opts);

        var self = opts.id || Id.random(idSize)
          , routeTable = RouteTable(self, idSize, opts.bucketSize)
        ;

        function closestPeer(id) {
            return routeTable.getBucket(id).sort(function(a, b) {
                return Id.compare(dist(id, a), dist(id, b));
            })[0];
        }
    }

    function RouteTable(self, idSize, bucketSize) {
        var bits    = idSize * 8
          , buckets = []
        ;

        addBucket();

        function insert(peer) {
            var id     = peer.id
              , res    = getBucket(id)
              , bucket = res[0]
              , pos    = res[1];
            if (bucket.length >= bucketSize) {
                if (pos === buckets.length - 1 && pos < bits - 1) {
                    split(bucket);
                    return insert(peer);
                }
            }
            else {
                bucket.push(peer);
                bucket.lastChange = new Date();
            }
        }

        function getBucket(id) {
            var dist = Id.dist(id, self)
              , ord  = Id.sigBit(dist)
              , pos  = bits - ord;
              , actualPos = Math.min(pos, buckets.length - 1);
            return [buckets[actualPos], actualPos];
        }

        function split() {
            var oldBucket = buckets.pop();
            addBucket();
            addBucket();
            oldBucket.forEach(insert);
        }

        function addBucket() {
            buckets.push(Bucket());
        }

        return {
            insert: insert;
        };
    }

    function Bucket() {
        var bucket = [];
        bucket.lastChange = new Date();
        return bucket;
    }

    function Peer() {
        var peer = {};
        peer.status = 'good';
        return peer;
    }

    var defaults = {
        id: undefined,
        idSize: 20 /* bytes */,
        prefix: 4,  // TODO: 4? really?
        bucketSize: 8
    };

    function extend() {
        var args   = Array.prototype.slice.call(arguments)
          , target = args.shift();
        args.forEach(function(arg) {
            Object.keys(arg).forEach(function(k) {
                if (typeof k !== 'undefined') {
                    target[k] = arg[k];
                }
            });
        });
        return target;
    }

    return DHT;
});
