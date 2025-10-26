const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

function initPassport(passport) {
  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (email, password, done) => {
        try {
          const user = await User.findOne({ email: email.toLowerCase() });
          if (!user) return done(null, false, { message: 'Barua pepe au nenosiri si sahihi.' });
          const match = await bcrypt.compare(password, user.passwordHash);
          if (!match) return done(null, false, { message: 'Barua pepe au nenosiri si sahihi.' });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id)
        .select('-passwordHash -resetToken -resetExpires')
        .lean();
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}

module.exports = initPassport;
