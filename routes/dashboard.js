const express = require('express');
const { ensureAuth } = require('../middlewares/authCheck');
const Service = require('../models/Service');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');

const router = express.Router();

router.get('/', ensureAuth, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [recentOrders, totalOrders, processingCount, pendingCount, completedCount] = await Promise.all([
      Order.find({ userId }).sort({ createdAt: -1 }).limit(5).populate('serviceId', 'name').lean(),
      Order.countDocuments({ userId }),
      Order.countDocuments({ userId, status: 'processing' }),
      Order.countDocuments({ userId, status: 'pending' }),
      Order.countDocuments({ userId, status: 'completed' }),
    ]);

    res.render('dashboard/index', {
      title: 'Dashibodi Yangu',
      description: 'Muhtasari wa akaunti yako na shughuli za karibuni.',
      keywords: 'dashibodi, maagizo, salio',
      page: 'dashboard',
      recentOrders,
      totalOrders,
      processingCount,
      pendingCount,
      completedCount,
    });
  } catch (err) {
    next(err);
  }
});

// Services list
router.get('/services', ensureAuth, async (req, res, next) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ category: 1, name: 1 }).lean();
    res.render('dashboard/services', {
      title: 'Huduma Zetu',
      description: 'Orodha ya huduma zilizo hai na bei zake.',
      keywords: 'huduma, bei, smm',
      page: 'services',
      services,
    });
  } catch (err) {
    next(err);
  }
});

// New order form
router.get('/new-order', ensureAuth, async (req, res, next) => {
  try {
    const services = await Service.find({ isActive: true }).sort({ category: 1, name: 1 }).lean();
    const categories = Array.from(new Set(services.map(s => s.category))).sort();
    res.render('dashboard/new-order', {
      title: 'Weka Oda Mpya',
      description: 'Chagua huduma, idadi, na kiungo kisha wasilisha.',
      keywords: 'oda mpya, huduma, smm',
      page: 'new-order',
      services,
      categories,
    });
  } catch (err) {
    next(err);
  }
});

// Create order (non-HTMX flow)
router.post('/new-order', ensureAuth, async (req, res, next) => {
  try {
    const user = req.user;
    const { serviceId, quantity, link } = req.body;
    const qty = Number(quantity);
    const service = await Service.findById(serviceId).lean();
    if (!service || !service.isActive) {
      req.flash('error', 'Huduma haipatikani au imezimwa.');
      return res.redirect('/dashboard/new-order');
    }
    if (!Number.isFinite(qty) || qty < service.min || qty > service.max) {
      req.flash('error', `Kiasi kinapaswa kuwa kati ya ${service.min} na ${service.max}.`);
      return res.redirect('/dashboard/new-order');
    }
    if (!link || String(link).trim().length < 3) {
      req.flash('error', 'Tafadhali weka kiungo sahihi.');
      return res.redirect('/dashboard/new-order');
    }
    const price = qty * service.pricePerUnit;
    // Ensure latest balance from DB
    const User = require('../models/User');
    const freshUser = await User.findById(user._id);
    if ((freshUser.balance || 0) < price) {
      req.flash('error', 'Salio halitoshi kukamilisha oda hii.');
      return res.redirect('/dashboard/new-order');
    }

    // Debit and create order + transaction (simple sequence)
    freshUser.balance = (freshUser.balance || 0) - price;
    await freshUser.save();
    const order = await Order.create({ userId: user._id, serviceId, quantity: qty, link: String(link).trim(), price });
    await Transaction.create({ userId: user._id, type: 'debit', amount: price, balanceAfter: freshUser.balance, reference: `ORDER:${order._id}` });
    // Reflect in session
    req.user.balance = freshUser.balance;
    req.flash('success', 'Oda imeundwa kwa mafanikio.');
    return res.redirect('/dashboard/orders');
  } catch (err) {
    next(err);
  }
});

// Orders list
router.get('/orders', ensureAuth, async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('serviceId', 'name')
      .lean();
    res.render('dashboard/orders', {
      title: 'Oda Zangu',
      description: 'Orodha ya oda zako na hali zake.',
      keywords: 'oda, historia, hali',
      page: 'orders',
      orders,
    });
  } catch (err) {
    next(err);
  }
});

// Add funds (mock)
router.get('/add-funds', ensureAuth, async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    res.render('dashboard/add-funds', {
      title: 'Ongeza Salio',
      description: 'Ongeza salio lako (mfano wa malipo).',
      keywords: 'salio, kuongeza, malipo',
      page: 'add-funds',
      transactions,
    });
  } catch (err) { next(err); }
});

router.post('/add-funds', ensureAuth, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      req.flash('error', 'Kiasi si sahihi.');
      return res.redirect('/dashboard/add-funds');
    }
    const User = require('../models/User');
    const freshUser = await User.findById(req.user._id);
    freshUser.balance = (freshUser.balance || 0) + amount;
    await freshUser.save();
    await Transaction.create({ userId: req.user._id, type: 'credit', amount, balanceAfter: freshUser.balance, reference: 'MOCK-TOPUP' });
    req.user.balance = freshUser.balance;
    req.flash('success', 'Salio limeongezwa kwa mafanikio.');
    return res.redirect('/dashboard');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
