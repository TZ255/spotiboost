const express = require('express');
const { ensureAuth } = require('../middlewares/authCheck');
const { ensureAdmin } = require('../middlewares/adminCheck');
const User = require('../models/User');
const Service = require('../models/Service');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Admin overview
router.get('/', ensureAuth, ensureAdmin, async (req, res, next) => {
  try {
    const [usersCount, servicesActive, ordersPending, totalCredited] = await Promise.all([
      User.countDocuments({}),
      Service.countDocuments({ isActive: true }),
      Order.countDocuments({ status: 'pending' }),
      Transaction.aggregate([
        { $match: { type: 'credit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(r => (r[0]?.total || 0))
    ]);
    res.render('admin/index', {
      title: 'Admin • Overview',
      description: 'Summary of key system metrics.',
      keywords: 'admin, overview, metrics',
      page: 'dashboard',
      usersCount,
      servicesActive,
      ordersPending,
      totalCredited,
    });
  } catch (err) { next(err); }
});

// Services management
router.get('/services', ensureAuth, ensureAdmin, async (req, res, next) => {
  try {
    const services = await Service.find({}).sort({ createdAt: -1 }).lean();
    res.render('admin/services', {
      title: 'Admin • Services',
      description: 'Create or edit SMM services.',
      keywords: 'admin, services, pricing',
      page: 'dashboard',
      services,
    });
  } catch (err) { next(err); }
});

router.post('/services', ensureAuth, ensureAdmin, async (req, res, next) => {
  try {
    const { name, category, pricePerUnit, min, max, description } = req.body;
    const errors = [];
    if (!name || !category) errors.push('Please provide service name and category.');
    const price = Number(pricePerUnit);
    const vmin = Number(min || 10);
    const vmax = Number(max || 10000);
    if (!Number.isFinite(price) || price <= 0) errors.push('Price is invalid.');
    if (!Number.isFinite(vmin) || !Number.isFinite(vmax) || vmin <= 0 || vmax < vmin) errors.push('Min/Max is invalid.');
    if (errors.length) {
      req.flash('error', errors.join(' '));
      return res.redirect('/admin/services');
    }
    await Service.create({ name: name.trim(), category: category.trim(), pricePerUnit: price, min: vmin, max: vmax, description: (description||'').trim() });
    req.flash('success', 'Service added successfully.');
    return res.redirect('/admin/services');
  } catch (err) { next(err); }
});

router.post('/services/:id/toggle', ensureAuth, ensureAdmin, async (req, res, next) => {
  try {
    const s = await Service.findById(req.params.id);
    if (!s) { req.flash('error', 'Service not found.'); return res.redirect('/admin/services'); }
    s.isActive = !s.isActive;
    await s.save();
    req.flash('success', 'Service status updated.');
    return res.redirect('/admin/services');
  } catch (err) { next(err); }
});

// Users management
router.get('/users', ensureAuth, ensureAdmin, async (req, res, next) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 }).lean();
    res.render('admin/users', {
      title: 'Admin • Users',
      description: 'List of users, roles and balances.',
      keywords: 'admin, users, roles',
      page: 'dashboard',
      users,
    });
  } catch (err) { next(err); }
});

router.post('/users/:id/role', ensureAuth, ensureAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      req.flash('error', 'Role is invalid.');
      return res.redirect('/admin/users');
    }
    await User.updateOne({ _id: req.params.id }, { $set: { role } });
    req.flash('success', 'Role updated.');
    return res.redirect('/admin/users');
  } catch (err) { next(err); }
});

router.post('/users/:id/fund', ensureAuth, ensureAdmin, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount === 0) { req.flash('error', 'Amount is invalid.'); return res.redirect('/admin/users'); }
    const user = await User.findById(req.params.id);
    if (!user) { req.flash('error', 'User not found.'); return res.redirect('/admin/users'); }
    user.balance = (user.balance || 0) + amount;
    await user.save();
    await Transaction.create({ userId: user._id, type: amount > 0 ? 'credit' : 'debit', amount: Math.abs(amount), balanceAfter: user.balance, reference: 'ADMIN-ADJUST' });
    req.flash('success', 'User balance updated.');
    return res.redirect('/admin/users');
  } catch (err) { next(err); }
});

// Orders moderation
router.get('/orders', ensureAuth, ensureAdmin, async (req, res, next) => {
  try {
    const status = (req.query.status || 'pending');
    const query = status === 'all' ? {} : { status };
    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(100).populate('serviceId', 'name').populate('userId', 'email name').lean();
    res.render('admin/orders', {
      title: 'Admin • Orders',
      description: 'Moderate and update order statuses.',
      keywords: 'admin, orders, moderation',
      page: 'dashboard',
      status,
      orders,
    });
  } catch (err) { next(err); }
});

router.post('/orders/:id/status', ensureAuth, ensureAdmin, async (req, res, next) => {
  try {
    const { status, refund } = req.body;
    if (!['pending','processing','completed','failed'].includes(status)) {
      req.flash('error', 'Status is invalid.');
      return res.redirect('/admin/orders');
    }
    const order = await Order.findById(req.params.id);
    if (!order) { req.flash('error', 'Order not found.'); return res.redirect('/admin/orders'); }
    order.status = status;
    await order.save();
    // Optional refund when marking failed
    if (status === 'failed' && refund) {
      const user = await User.findById(order.userId);
      user.balance = (user.balance || 0) + order.price;
      await user.save();
      await Transaction.create({ userId: user._id, type: 'credit', amount: order.price, balanceAfter: user.balance, reference: 'ADMIN-REFUND' });
    }
    req.flash('success', 'Order status updated.');
    return res.redirect('/admin/orders');
  } catch (err) { next(err); }
});

module.exports = router;
