// Load dotenv
import {config} from 'dotenv';
config();

import express from 'express';
import {Application, Request, Response} from 'express';
import cors from 'cors';
import passport from './src/passport';
import {HttpError} from "./src/httperror";

const app: Application = express();

// Trust proxy in 'production'
if (app.get('env') === 'production') {
    app.set('trust proxy', true);
}

// CORS
app.use(cors());

// Simple SPA to test functionality
app.get('/', (req: Request, res: Response) => {
    res.sendFile(__dirname + '/html/spa.html');
});

// Include routes
app.use('/auth/avans', require('./src/routes/auth/avans'));

// All the following routes are protected
app.use(passport.authenticate('jwt', {session: false}));

app.get('/me', (req: Request, res: Response) => {
    res.json(req.user);
});

app.use((req: Request, res: Response, next: (error?: HttpError) => void) => {
    let error = new HttpError('Not found');
    error.status = 404;
    next(error);
});

app.use((err: HttpError, req: Request, res: Response, next: (error?: HttpError) => void) => {
    let status = err.status || 404;

    res.status(status).send({error: err.message});
});

// Start server
const server = app.listen(3000, () => console.log('Listening on port 3000'));

// Websocket
import io from './src/websocket';

io.attach(server, {
    handlePreflightRequest: (req: Request, res: Response) => {
        let header: string = req.header('origin') || '';

        res.setHeader('Access-Control-Allow-Origin', header);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization');
        res.writeHead(200);
        res.end('ok');
    }
});
