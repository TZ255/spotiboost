module.exports.ensureAdmin = function ensureAdmin(req, res, next) {
  const isAuthed = req.isAuthenticated && req.isAuthenticated();
  const isAdmin = isAuthed && req.user && req.user.role === 'admin';
  if (isAdmin) return next();

  const msg = 'Huna ruhusa ya kufikia ukurasa huu.';
  try { req.flash && req.flash('error', msg); } catch (_) {}

  if (req.get && req.get('HX-Request')) {
    res.set('HX-Redirect', '/dashboard');
    return res.status(200).end();
  }
  return res.redirect('/dashboard');
};

