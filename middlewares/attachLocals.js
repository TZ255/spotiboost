const { URL } = require('url');

module.exports = function attachLocals(req, res, next) {
  const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  // Canonical URL (avoid double slashes)
  let canonical = BASE_URL.replace(/\/$/, '') + req.originalUrl;
  try {
    canonical = new URL(req.originalUrl, BASE_URL).toString();
  } catch (_) {}

  res.locals.BASE_URL = BASE_URL;
  res.locals.canonical = canonical;
  res.locals.siteName = 'Spoti Boost';
  res.locals.path = req.path;
  res.locals.user = req.user || null;
  // Only read (and clear) flash if it exists to avoid modifying new sessions
  const hasFlash = req.session && req.session.flash && Object.keys(req.session.flash).length > 0;
  res.locals.flash = hasFlash
    ? {
        success: req.flash('success') || [],
        error: req.flash('error') || [],
        info: req.flash('info') || [],
        warning: req.flash('warning') || []
      }
    : { success: [], error: [], info: [], warning: [] };
  // Defaults for meta (can be overridden per render)
  res.locals.title = res.locals.title || 'Spoti Boost';
  res.locals.description = res.locals.description || 'Spoti Boost — Paneli ya SMM kwa Tanzania.';
  res.locals.keywords = res.locals.keywords || 'smm, tanzania, huduma za mitandao, bei nafuu';
  next();
};
