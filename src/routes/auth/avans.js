const express = require('express');
const passport = require('passport');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const AvansStrategy = require('passport-avans').Strategy;
const uuid = require('uuid/v4');
const router = express.Router();

passport.use(new AvansStrategy({
        consumerKey: process.env.AVANS_CONSUMER_KEY,
        consumerSecret: process.env.AVANS_CONSUMER_SECRET,
        callbackURL: process.env.AVANS_CALLBACK_URL
    },
    (token, tokenSecret, profile, done) => {
        profile.token = token;
        profile.tokenSecret = tokenSecret;
        done(null, profile);
    }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((profile, done) => done(null, profile));

let sess = {
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 3600000
    }
};

if (process.env.NODE_ENV === 'production') {
    sess.cookie.secure = true;
}

router.use(session(sess));
router.use(passport.initialize());
router.use(passport.session());

const sessions = {};

router.get('/', (req, res, next) => {
    let callback = req.query.callback || req.query.redirect_uri || '';
    let client_id = req.query.client_id || '';

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

    passport.authenticate('avans', { callbackURL: apiCallbackUrl })(req, res, next);
});

router.get('/callback/:session', (req, res, next) => {
    let sessionId = req.params.session;

    // Load session from object
    if (sessionId) {
        req.session = sessions[sessionId].session;
    }

    passport.authenticate('avans', { failureRedirect: '/auth/avans' }, (err, user, info) => {
        if (sessionId) {
            delete sessions[sessionId];
        }

        if (err) {
            next(err);
            return;
        }

        if (!req.session.callback) {
            let error = new Error("Missing callback to redirect to");
            error.status = 400;
            next(error);
            return;
        }

        if (!user) {
            let error = new Error("Avans authentication failed");
            error.status = 500;
            next(error);
            return;
        }

        jwt.sign(user, process.env.JWT_SECRET, (err, token) => {
            if (err) {
                next(err);
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
        if (session[1].date < Date.now() - (60 * 60 * 1000)) { // One hour
            delete sessions[session[0]];
        }
    });
}, 5 * 60 * 1000); // 5 minutes

module.exports = router;
