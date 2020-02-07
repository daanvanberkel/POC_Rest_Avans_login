require('dotenv').config();

const express = require('express');
const cors = require('cors');
const passport = require('./src/passport');

const app = express();

console.log('Environment', app.get('env'));

// Trust proxy in 'production'
if (app.get('env') === 'production') {
    app.set('trust proxy', true);
}

// CORS
app.use(cors());

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/html/spa.html');
});

app.use('/auth/avans', require('./src/routes/auth/avans'));

// Vanaf hier moeten alle requests een JWT bevatten
app.use(passport.authenticate('jwt', {session: false}));

app.get('/me', (req, res) => {
    res.json(req.user);
});

app.use((req, res, next) => {
    let error = new Error('Not found');
    error.status = 404;
    next(error);
});

app.use((err, req, res, next) => {
    let status = err.status || 404;

    res.status(status).send({error: err.message});
});

// Start server
const server = app.listen(3000, () => console.log('Listening on port 3000'));

// Websocket
require('./src/websocket.js').attach(server, {
    handlePreflightRequest: (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization');
        res.writeHead(200);
        res.end('ok');
    }
});
