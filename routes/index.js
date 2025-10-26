const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index/index', {
    title: 'Karibu Spoti Boost',
    description: 'Paneli ya SMM kwa Tanzania: weka oda kwa haraka na bei nafuu.',
    keywords: 'smm, tanzania, mitandao ya kijamii, followers, likes, bei nafuu',
    page: 'home',
  });
});

module.exports = router;
