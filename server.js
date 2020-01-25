require('dotenv').config();

const express = require('express');
const app = express();
const passportMiddleware = require('./src/passport');

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/html/spa.html');
});

app.use('/auth/avans', require('./src/routes/auth/avans'));

// Vanaf hier moeten alle requests een JWT bevatten
app.use(passportMiddleware);

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

app.listen(3000, () => console.log('Listening on port 3000'));
