import socketio from "socket.io";
import passport from "./passport";
import {Handshake, Server, Socket} from "socket.io";
import {Profile} from "./models/profile";

const io: Server = socketio();

// Authenticate client
io.use((socket: Socket, next) => {
    let req: Handshake = socket.handshake;

    console.log('Starting to authenticate for socket');

    passport.authenticate('jwt', (err: Error, user: Profile, info) => {
        if (err || !user) {
            next(new Error('Not authenticated'));
            return;
        }

        // @ts-ignore not official supported, but it works
        socket.user = user;
        next();
    })(req, null, next);
});

// Handle messages
let selectedSlots: any[] = [];

io.on('connection', function(socket: Socket) {
    // @ts-ignore not official supported, but it works
    let user: Profile = socket.user;

    console.log(`${user.id} connected`);

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

export default io;
