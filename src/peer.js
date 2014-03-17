export {
    create
};

function create(id, conn, broker) {
    return Object.freeze({
        id:     id,
        conn:   conn,
        broker: broker
    });
}
