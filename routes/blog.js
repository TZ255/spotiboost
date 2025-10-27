const router = require('express').Router();
const path = require('path');
const fs = require('fs');

const { parseMarkdown, loadPostsMeta } = require('../utils/mdParser');

router.get('/', async (req, res, next) => {
  try {
    const posts = await loadPostsMeta();
    return res.render('blog/index', {
      title: 'Blogu ya Spoti Boost',
      description: 'Makala na vidokezo kuhusu ukuaji wa mitandao ya kijamii na huduma zetu.',
      keywords: 'blogu, makala, mitandao ya kijamii, ushauri, tanzania',
      page: 'blog',
      posts,
    });
  } catch (err) { next(err); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    const filePath = path.join(__dirname, '..', 'blog/posts', `${slug}.md`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).render('errors/404', {
        title: 'Makala Haipatikani',
        description: 'Samahani, makala uliyoomba haipatikani.',
        keywords: '404, makala haipatikani',
        page: '404',
      });
    }
    const { meta, html, toc } = await parseMarkdown(filePath);
    return res.render('blog/post', {
      title: meta.title || 'Makala',
      description: meta.description || 'Makala kutoka Spoti Boost',
      keywords: meta.keywords || 'blogu, makala, smm',
      page: 'blog-post',
      meta,
      blog_body: html,
      toc,
      slug,
    });
  } catch (err) { next(err); }
});

module.exports = router;
