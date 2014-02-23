define('bitstar/route_table', ['./id', 'mori', 'lodash'], function(Id, mori, _) {
    'use strict';

    function create(idSelf, idSize /* bytes */, bucketSize) {
        return Object.freeze({
            idSelf:        idSelf,
            idSize:        idSize,
            maxBucketSize: bucketSize,
            buckets:       mori.vector(createBucket())
        });
    }

    // Size of ids in bits
    function bitsize(table) {
        return table.idSize * 8;
    }

    function insert(table, peer) {
        if (contains(table, peer)) { return table; }

        var id          = peer.id
          , index       = getBucketIndex(table, id)
          , bucket      = mori.nth(table.buckets, index)
          , bucketSize  = mori.count(bucket)
          , bucketCount = mori.count(table.buckets);
        if (bucketSize >= table.maxBucketSize) {
            if (index === bucketCount - 1 && index < bitsize(table) - 1) {
                return insert(split(table), peer);
            }
            // TODO: check for bad peers to replace or push peer
            // into reserve list
        }
        else {
            // New peer is pushed onto the end of the bucket.
            // Buckets wind up ordered by length of time peers have
            // stayed connected.
            return modify(table, 'buckets',
                mori.assoc_in(table.buckets, [index], mori.conj(bucket, peer)));
            //bucket.lastChange = new Date();  // TODO:
        }
    }

    function remove(table, peerOrId) {
        var peer_  = toPeer(peerOrId)
          , index  = getBucketIndex(table, peer.id);
        mori.update_in(table.buckets, [index], function(bucket) {
            return mori.disj(bucket, peer_);
        });
        // TODO: fill position from reserve list
    }

    function split(table) {
        var oldBucket  = mori.last(table.buckets)
          , newBuckets = mori.conj(
                mori.pop(table.buckets),
                createBucket(),
                createBucket()
          )
          , newTable = modify(table, 'buckets', newBuckets);
        return mori.reduce(insert, newTable, oldBucket);
    }

    function contains(table, peerOrId) {
        var peer = toPeer(peerOrId)
          , peer_ = closest(table, peer)[0];
        return !!(peer_ && peer_.id === peer.id);
    }

    function closest(table, peerOrId) {
        var id     = toId(peerOrId)
          , bucket = getBucket(table, id);
        return mori.sort_by(function(a, b) {
            return Id.compare(Id.dist(id, a.id), Id.dist(id, b.id));
        }, bucket);
    }

    function peers(table) {
        return mori.concat.apply(null, table.buckets);
    }

    function getBucket(table, peerOrId) {
        var id    = toId(peerOrId);
        var index = getBucketIndex(table, id);
        return mori.nth(table.buckets, index);
    }

    function getBucketIndex(table, peerOrId) {
        var id    = toId(peerOrId)
          , dist  = Id.dist(id, table.idSelf)
          , ord   = Id.sigBit(dist)
          , pos   = bitsize(table) - ord
          , index = Math.min(pos, mori.count(table.buckets) - 1);
        return index;
    }

    function modify(table, key, val) {
        var updated = {};
        updated[key] = val;
        _.assign(updated, table);
        return Object.freeze(updated);
    }

    function toPeer(peerOrId) {
        return peerOrId.id ? peerOrId : { id: peerOrId };
    }

    function toId(peerOrId) {
        return peerOrId.id ? peerOrId : peerOrId;
    }

    function createBucket() {
        return mori.sorted_set_by(comparePeers);
        // TODO: record lastChange property
    }

    function comparePeers(a, b) {
        return Id.compare(a.id, b.id);
    }

    return {
        create:   create,
        insert:   insert,
        remove:   remove,
        contains: contains,
        closest:  closest,
        peers:    peers
    };

});
