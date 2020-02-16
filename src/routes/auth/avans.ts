import passport from "../../passport";
import express from 'express';
import {NextFunction, Request, Response, Router} from "express";
import {Profile} from "../../models/profile";
import session, {SessionOptions} from "express-session";
import {HttpError} from "../../httperror";
import uuid from "uuid/v4";
import {sign} from 'jsonwebtoken';
const AvansStrategy = require('passport-avans').Strategy;

const router: Router = express.Router();

passport.use(new AvansStrategy({
        consumerKey: process.env.AVANS_CONSUMER_KEY,
        consumerSecret: process.env.AVANS_CONSUMER_SECRET,
        callbackURL: process.env.AVANS_CALLBACK_URL
    },
    (token: string, tokenSecret: string, profile: Profile, done: (error: Error|null, profile: Profile) => void) => {
        profile.token = token;
        profile.tokenSecret = tokenSecret;
        done(null, profile);
    }
));

passport.serializeUser((user: Profile, done: (error: Error|null, profile: Profile) => void) => done(null, user));
passport.deserializeUser((profile: Profile, done: (error: Error|null, profile: Profile) => void) => done(null, profile));

let sess: SessionOptions = {
    secret: process.env.SESSION_SECRET || '',
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 3600000,
        secure: process.env.NODE_ENV == 'production' ? true : 'auto'
    }
};

router.use(session(sess));
router.use(passport.initialize());
router.use(passport.session());

const sessions: any = {};

router.get('/', (req: Request, res: Response, next: NextFunction) => {
    let callback = req.query.callback || req.query.redirect_uri || '';
    let client_id = req.query.client_id || '';

    if (!req.session) {
        res.status(500).send({error: 'Missing session'});
        return;
    }

    req.session.oauth_state = (req.query.state || '');

    // Use custom scheme for android client to App Link or Deeplink
    // @see https://capacitor.ionicframework.com/docs/android/configuration/
    if (client_id && client_id === 'speedmeetand') {
        callback = process.env.AVANS_ANDROID_CALLBACK;
    }

    if (callback) {
        req.session.callback = callback;
    } else {
        res.status(400).send({error: 'Missing callback'});
        return;
    }

    // Save session in object, the android client starts the request in an InAppBrowser, but ends it in Google Chrome,
    // so the cookie is lost in the process
    let sessionId = uuid();
    sessions[sessionId] = {
        session: req.session,
        date: Date.now()
    };

    let apiCallbackUrl = process.env.AVANS_CALLBACK_URL + '/' + sessionId;

    // @ts-ignore callbackURL is in passport-avans, bus has no .d.ts file
    passport.authenticate('avans', { callbackURL: apiCallbackUrl })(req, res, next);
});

router.get('/callback/:session', (req: Request, res: Response, next: NextFunction) => {
    let sessionId: string = req.params.session;

    // Load session from object
    if (sessionId) {
        req.session = sessions[sessionId].session;
    }

    passport.authenticate('avans', { failureRedirect: '/auth/avans' }, (err: Error, user: Profile, info: any) => {
        if (sessionId) {
            delete sessions[sessionId];
        }

        if (err) {
            next(err);
            return;
        }

        if (!req.session) {
            let error = new HttpError("Missing session");
            error.status = 500;
            next(error);
            return;
        }

        if (!req.session.callback) {
            let error = new HttpError("Missing callback to redirect to");
            error.status = 400;
            next(error);
            return;
        }

        if (!user) {
            let error = new HttpError("Avans authentication failed");
            error.status = 500;
            next(error);
            return;
        }

        sign(user, process.env.JWT_SECRET || '', (err: Error, token: string) => {
            if (err) {
                next(err);
                return;
            }

            if (!req.session) {
                let error = new HttpError("Missing session");
                error.status = 500;
                next(error);
                return;
            }

            let callback = new URL(req.session.callback);
            callback.searchParams.append('access_token', token);

            if (req.session.oauth_state) {
                callback.searchParams.append('state', req.session.oauth_state);
            }

            res.redirect(callback.toString());
        });
    })(req, res, next);
});

// Remove old session that are not in use anymore
setInterval(function() {
    Object.entries(sessions).forEach(session => {
        // @ts-ignore
        if (session[1].date < Date.now() - (30 * 60 * 1000)) { // 30 minutes
            delete sessions[session[0]];
        }
    });
}, 5 * 60 * 1000); // 5 minutes

export = router;
