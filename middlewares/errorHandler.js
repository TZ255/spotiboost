module.exports.notFound = (req, res) => {
  res.status(404).render('errors/404', {
    title: 'Ukurasa Haupo',
    description: 'Samahani, ukurasa uliotafuta haupo.',
    keywords: '404, ukurasa haupo, kosa',
    page: '404',
  });
};

module.exports.serverError = (err, req, res, next) => {
  // Log detailed error on server only
  // eslint-disable-next-line no-console
  console.error(err && err.stack ? err.stack : err);
  res.status(500).render('errors/500', {
    title: 'Hitilafu ya Ndani',
    description: 'Kuna hitilafu upande wetu. Tafadhali jaribu tena baadae.',
    keywords: '500, hitilafu ya ndani, kosa',
    page: '500',
  });
};
