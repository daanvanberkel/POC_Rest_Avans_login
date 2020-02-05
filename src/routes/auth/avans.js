const express = require('express');
const passport = require('passport');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const AvansStrategy = require('passport-avans').Strategy;
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

router.use(session({secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true}));
router.use(passport.initialize());
router.use(passport.session());

router.get('/', (req, res, next) => {
    let callback = req.query.callback || req.query.redirect_uri || '';
    req.session.oauth_state = (req.query.state || '');

    if (callback) {
        req.session.callback = callback;
    } else {
        res.status(400).send({error: 'Missing callback'});
        return;
    }

    next();
}, passport.authenticate('avans'));

router.get('/callback', passport.authenticate('avans', { failureRedirect: '/auth/avans' }), (req, res, next) => {
    if (!req.session.callback) {
        let error = new Error("Missing callback to redirect to");
        error.status = 400;
        next(error);
        return;
    }

    if (!req.user) {
        let error = new Error("Avans authentication failed");
        error.status = 500;
        next(error);
        return;
    }

    jwt.sign(req.user, process.env.JWT_SECRET, (err, token) => {
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
});

module.exports = router;
