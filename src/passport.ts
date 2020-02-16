import passport from "passport";
import passportJwt from 'passport-jwt';

let p = new passport.Authenticator();

p.use(new passportJwt.Strategy({
    jwtFromRequest: passportJwt.ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
}, (jwtPayload, cb) => {
    return cb(null, jwtPayload);
}));

export default p;
