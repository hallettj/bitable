define('bitstar/peer', [
    'when/when',
    'when/timed',
    'Bacon',
    'lodash'
], function(when, t, Bacon, _) {
    'use strict';

    function create(id, conn, broker) {
        return Object.freeze({
            id:     id,
            conn:   conn,
            broker: broker
        });
    }

    return {
        create: create
    };
});
