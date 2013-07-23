define('kademlia/dht', ['./id'], function(Id) {
    'use strict';

    function DHT(opts) {
        opts = extend({}, defaults, opts);

        var id = opts.id || Id.makeId(idSize)
          , routeTable = RouteTable(id, idSize, opts.bucketSize)
        ;
    }

    function RouteTable(self, idSize, bucketSize) {
        var bits    = idSize * 8
          , buckets = []
        ;

        addBucket();

        function insert(id, peer) {
            var res    = getBucket(id)
              , bucket = res[0]
              , pos    = res[1];
            if (bucket.length >= bucketSize) {
                if (pos === buckets.length - 1 && pos < bits) {
                    split(bucket);
                    return insert(id, peer);
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
            oldBucket.forEach(function(peer) {
                insert(peer.id, peer);
            });
        }

        function addBucket() {
            buckets.push(new Bucket());
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
