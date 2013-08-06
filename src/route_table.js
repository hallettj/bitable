define('kademlia/route_table', ['./id'], function(Id) {
    'use strict';

    function RouteTable(idSelf, idSize, bucketSize) {
        var numBits = idSize * 8
          , buckets = []
        ;

        addBucket();

        function insert(peer) {
            if (contains(peer.id)) { return; }

            var id     = peer.id
              , index  = getBucketIndex(id)
              , bucket = buckets[index];
            if (bucket.length >= bucketSize) {
                if (index === buckets.length - 1 && index < numBits - 1) {
                    split(bucket);
                    return insert(peer);
                }
                // TODO: check for bad peers to replace or push peer
                // into reserve list
            }
            else {
                bucket.push(peer);
                bucket.lastChange = new Date();
            }
        }

        function remove(peer) {
            var id     = peer.id ? peer.id : id
              , index  = getBucketIndex(id)
              , bucket = buckets[index];
            buckets[index] = new Bucket(bucket.filter(function(peer) {
                return peer.id !== id;
            }));
            // TODO: fill position from reserve list
        }

        function contains(id) {
            var peer = closest(id)[0];
            return !!(peer && peer.id === id);
        }

        function closest(id) {
            return getBucket(id).slice().sort(function(a, b) {
                return Id.compare(Id.dist(id, a.id), Id.dist(id, b.id));
            });
        }

        function getBucket(id) {
            var index = getBucketIndex(id);
            return buckets[index];
        }

        function getBucketIndex(id) {
            var dist  = Id.dist(id, idSelf)
              , ord   = Id.sigBit(dist)
              , pos   = numBits - ord
              , index = Math.min(pos, buckets.length - 1);
            return index;
        }

        function split() {
            var oldBucket = buckets.pop();
            addBucket();
            addBucket();
            oldBucket.forEach(insert);
        }

        function addBucket() {
            buckets.push(new Bucket());
        }

        return {
            insert:  insert,
            remove:  remove,
            closest: closest
        };
    }

    function Bucket(contents) {
        var bucket = contents || [];
        bucket.lastChange = new Date();
        return bucket;
    }

    return RouteTable;

});
