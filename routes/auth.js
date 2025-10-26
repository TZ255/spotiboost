const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { ensureGuest } = require('../middlewares/authCheck');
const { sendPasswordResetEmail } = require('../utils/resend');
const { normalizePhone } = require('../utils/phone');

const router = express.Router();

// Render: Login
router.get('/login', ensureGuest, (req, res) => {
  res.render('auth/login', {
    title: 'Ingia kwenye akaunti',
    description: 'Ingia ili kufikia dashibodi yako ya Spoti Boost.',
    keywords: 'ingia, akaunti, spoti boost',
    page: 'auth-login',
  });
});

// Render: Register
router.get('/register', ensureGuest, (req, res) => {
  res.render('auth/register', {
    title: 'Jiunge na Spoti Boost',
    description: 'Jisajili ili kuanza kutumia huduma zetu za SMM.',
    keywords: 'jiunge, sajili, smm, tanzania',
    page: 'auth-register',
  });
});

// Render: Reset request
router.get('/reset', ensureGuest, (req, res) => {
  res.render('auth/reset', {
    title: 'Weka upya nenosiri',
    description: 'Tuma barua pepe kwa kiungo cha kuweka upya nenosiri.',
    keywords: 'weka upya, nenosiri, rudisha',
    page: 'auth-reset',
  });
});

// HTMX: Register submit
router.post('/register', async (req, res) => {
  const { name, email, phone, password, confirmPassword } = req.body;
  const errors = [];

  // Basic validations
  if (!name || name.trim().length < 2) errors.push('Jina ni lazima (angalau herufi 2).');
  const emailRegex = /.+@.+\..+/;
  if (!email || !emailRegex.test(email)) errors.push('Barua pepe si sahihi.');
  const phoneCheck = normalizePhone(phone);
  if (!phoneCheck.valid) errors.push(phoneCheck.reason || 'Namba ya simu si sahihi.');
  if (!password || password.length < 4) errors.push('Nenosiri linapaswa kuwa angalau herufi 4.');
  if (password !== confirmPassword) errors.push('Nenosiri na thibitisha nenosiri havilingani.');

  try {
    if (errors.length) {
      return res.render('fragments/auth-message', { layout: false, kind: 'danger', messages: errors });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const normalizedPhone = phoneCheck.normalized;
    const lowerEmail = email.toLowerCase();

    let user = await User.findOne({ email: lowerEmail });
    if (user) {
      user.name = name.trim();
      user.phone = normalizedPhone;
      user.passwordHash = passwordHash;
      await user.save();
    } else {
      user = await User.create({ name: name.trim(), email: lowerEmail, phone: normalizedPhone, passwordHash });
    }

    // Auto-login (creates the session)
    req.login(user, (err) => {
      if (err) {
        return res.render('fragments/auth-message', { layout: false, kind: 'danger', messages: ['Hitilafu ya kuingia baada ya usajili.'] });
      }
      res.set('HX-Redirect', '/dashboard');
      return res.status(200).end();
    });
  } catch (err) {
    console.error(err);
    return res.render('fragments/auth-message', { layout: false, kind: 'danger', messages: ['Hitilafu ya mfumo. Jaribu tena.'] });
  }
});

// HTMX: Login submit
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      const msg = info?.message || 'Hati si sahihi.';
      return res.render('fragments/auth-message', { layout: false, kind: 'danger', messages: [msg] });
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
      res.set('HX-Redirect', '/dashboard');
      return res.status(200).end();
    });
  })(req, res, next);
});

// HTMX: Logout
router.post('/logout', (req, res) => {
  const redirectTo = '/';
  const done = () => {
    const isHtmx = req.get('HX-Request');
    if (isHtmx) {
      res.set('HX-Redirect', redirectTo);
      return res.end();
    }
    return res.redirect(redirectTo);
  };

  try {
    req.logout?.(() => {
      req.session?.destroy?.(() => {
        res.clearCookie(process.env.SESSION_NAME || 'sb.sid');
        done();
      });
    });
  } catch (e) {
    done();
  }
});

// (removed) /auth/check-email — register updates existing user if email exists

// HTMX: Reset request submit
router.post('/reset', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user) {
    return res.render('fragments/auth-message', { layout: false, kind: 'info', messages: ['Ikiwa akaunti ipo, tumepeleka kiungo cha kuweka upya.'] });
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await User.updateOne({ _id: user._id }, { $set: { resetToken: token, resetExpires: expires } });
  const link = `${process.env.BASE_URL || 'http://localhost:3000'}/auth/reset/${token}`;
  await sendPasswordResetEmail(user.email, link);
  return res.render('fragments/auth-message', { layout: false, kind: 'success', messages: ['Ikiwa akaunti ipo, tumepeleka kiungo cha kuweka upya.'] });
});

// Render: Set new password via token (simple page)
router.get('/reset/:token', ensureGuest, (req, res) => {
  res.render('auth/new-password', {
    title: 'Weka Nenosiri Jipya',
    description: 'Weka nenosiri jipya la akaunti yako.',
    keywords: 'nenosiri jipya, kuweka upya',
    page: 'auth-reset',
    token: req.params.token,
  });
});

// HTMX: Set new password
router.post('/reset/:token', async (req, res) => {
  const { password, confirmPassword } = req.body;
  const { token } = req.params;
  const errors = [];
  if (!password || password.length < 4) errors.push('Nenosiri linapaswa kuwa angalau herufi 4.');
  if (password !== confirmPassword) errors.push('Nenosiri na thibitisha nenosiri havilingani.');
  if (errors.length) return res.render('fragments/auth-message', { layout: false, kind: 'danger', messages: errors });

  const user = await User.findOne({ resetToken: token, resetExpires: { $gt: new Date() } });
  if (!user) return res.render('fragments/auth-message', { layout: false, kind: 'danger', messages: ['Kiungo si sahihi au kimeisha muda.'] });

  const passwordHash = await bcrypt.hash(password, 10);
  user.passwordHash = passwordHash;
  user.resetToken = undefined;
  user.resetExpires = undefined;
  await user.save();

  res.set('HX-Redirect', '/auth/login');
  return res.end();
});

module.exports = router;
