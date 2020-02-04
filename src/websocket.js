const io = require('socket.io')();
const passport = require('./passport');

// Authenticate client
io.use((socket, next) => {
    let req = socket.handshake;

    console.log('Starting to authenticate for socket');

    passport.authenticate('jwt', (info, user, err) => {
        if (err) {
            next(new Error('Not authenticated'));
            return;
        }

        socket.user = user;
        next();
    })(req, null, next);
});

// Handle messages
let selectedSlots = [];

io.on('connection', function(socket) {
    console.log(`${socket.user.id} connected`);

    for (let slot of selectedSlots) {
        socket.emit('select', slot);
    }

    socket.on('select', (data) => {
        console.log('Broadcasting data', data);

        let index = selectedSlots.findIndex(slot => slot.slot === data.slot);

        if (index < 0) {
            selectedSlots.push(data);
        }

        socket.broadcast.emit('select', data);
    });

    socket.on('reset', () => {
        selectedSlots = [];

        socket.broadcast.emit('reset');
    })
});

module.exports = io;
