import { compare, dist, sigBit } from './id';
import { modify }                from './functional_utils';
import {
    assoc_in,
    concat,
    conj,
    count,
    disj,
    last,
    nth,
    pop,
    reduce,
    sort_by,
    sorted_set_by,
    update_in,
    vector
} from 'mori';

export {
    create,
    insert,
    remove,
    contains,
    closest,
    peers
};

function create(idSelf, idSize /* in bytes */, bucketSize) {
    return Object.freeze({
        idSelf:        idSelf,
        idSize:        idSize,
        maxBucketSize: bucketSize,
        buckets:       vector(createBucket())
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
      , bucket      = nth(table.buckets, index)
      , bucketSize  = count(bucket)
      , bucketCount = count(table.buckets);
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
            assoc_in(table.buckets, [index], conj(bucket, peer)));
        //bucket.lastChange = new Date();  // TODO:
    }
}

function remove(table, peerOrId) {
    var peer  = toPeer(peerOrId)
      , index = getBucketIndex(table, peer.id);
    update_in(table.buckets, [index], bucket => disj(bucket, peer));
    // TODO: fill position from reserve list
}

function split(table) {
    var oldBucket  = last(table.buckets)
      , newBuckets = conj(
            pop(table.buckets),
            createBucket(),
            createBucket()
        )
      , newTable = modify(table, 'buckets', newBuckets);
    return reduce(insert, newTable, oldBucket);
}

function contains(table, peerOrId) {
    var peer  = toPeer(peerOrId)
      , peer_ = closest(table, peer)[0];
    return !!(peer_ && peer_.id === peer.id);
}

function closest(table, peerOrId) {
    var id     = toId(peerOrId)
      , bucket = getBucket(table, id);
  return sort_by(
      (a, b) => compare(dist(id, a.id), dist(id, b.id)),
      bucket
  );
}

function peers(table) {
    return concat(...table.buckets);
}

function getBucket(table, peerOrId) {
    var id    = toId(peerOrId);
    var index = getBucketIndex(table, id);
    return nth(table.buckets, index);
}

function getBucketIndex(table, peerOrId) {
    var id    = toId(peerOrId)
      , d     = dist(id, table.idSelf)
      , pos   = bitsize(table) - sigBit(d)
      , index = Math.min(pos, count(table.buckets) - 1);
    return index;
}

function toPeer(peerOrId) {
    return peerOrId.id ? peerOrId : { id: peerOrId };
}

function toId(peerOrId) {
    return peerOrId.id ? peerOrId : peerOrId;
}

function createBucket() {
    return sorted_set_by(comparePeers);
    // TODO: record lastChange property
}

function comparePeers(a, b) {
    return compare(a.id, b.id);
}
