module.exports.ensureAuth = function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.get('HX-Request')) {
    res.set('HX-Redirect', '/auth/login');
    return res.status(200).end();
  }
  return res.redirect('/auth/login');
};

module.exports.ensureGuest = function ensureGuest(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    if (req.get('HX-Request')) {
      res.set('HX-Redirect', '/dashboard');
      return res.status(200).end();
    }
    return res.redirect('/dashboard');
  }
  next();
};
