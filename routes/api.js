const express = require('express');
const { ensureAuth } = require('../middlewares/authCheck');
const Service = require('../models/Service');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Services by category (returns <option> list)
router.get('/services', ensureAuth, async (req, res, next) => {
  try {
    const category = req.query.category;
    const q = { isActive: true };
    if (category) q.category = category;
    const services = await Service.find(q).sort({ name: 1 }).lean();
    return res.render('fragments/service-options', { layout: false, services });
  } catch (err) {
    next(err);
  }
});

// Compute price fragment
router.get('/price', ensureAuth, async (req, res, next) => {
  try {
    const { serviceId, qty } = req.query;
    const quantity = Number(qty);
    const service = await Service.findById(serviceId).lean();
    if (!service || !service.isActive) {
      return res.render('fragments/price', { layout: false, error: 'Huduma haipatikani.', total: null });
    }
    if (!Number.isFinite(quantity) || quantity < service.min || quantity > service.max) {
      return res.render('fragments/price', { layout: false, error: `Kiasi: ${service.min}–${service.max}`, total: null });
    }
    const total = quantity * service.pricePerUnit;
    return res.render('fragments/price', { layout: false, error: null, total });
  } catch (err) {
    next(err);
  }
});

// Create order and return row fragment
router.post('/orders', ensureAuth, async (req, res, next) => {
  try {
    const user = req.user;
    const { serviceId, quantity, link } = req.body;
    const qty = Number(quantity);
    const service = await Service.findById(serviceId).lean();
    if (!service || !service.isActive) {
      return res.render('fragments/order-row', { layout: false, order: null, error: 'Huduma haipatikani.' });
    }
    if (!Number.isFinite(qty) || qty < service.min || qty > service.max) {
      return res.render('fragments/order-row', { layout: false, order: null, error: `Kiasi: ${service.min}–${service.max}` });
    }
    if (!link || String(link).trim().length < 3) {
      return res.render('fragments/order-row', { layout: false, order: null, error: 'Kiungo si sahihi.' });
    }
    const price = qty * service.pricePerUnit;
    const User = require('../models/User');
    const freshUser = await User.findById(user._id);
    if ((freshUser.balance || 0) < price) {
      return res.render('fragments/order-row', { layout: false, order: null, error: 'Salio halitoshi.' });
    }
    freshUser.balance = (freshUser.balance || 0) - price;
    await freshUser.save();
    const order = await Order.create({ userId: user._id, serviceId, quantity: qty, link: String(link).trim(), price });
    await Transaction.create({ userId: user._id, type: 'debit', amount: price, balanceAfter: freshUser.balance, reference: `ORDER:${order._id}` });
    req.user.balance = freshUser.balance;
    // Refetch with populate for row fragment
    const populated = await Order.findById(order._id).populate('serviceId', 'name').lean();
    return res.render('fragments/order-row', { layout: false, order: populated, error: null });
  } catch (err) {
    next(err);
  }
});

// Credit funds and return balance fragment
router.post('/funds', ensureAuth, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.render('fragments/balance', { layout: false, balance: req.user.balance || 0, error: 'Kiasi si sahihi.' });
    }
    const User = require('../models/User');
    const freshUser = await User.findById(req.user._id);
    freshUser.balance = (freshUser.balance || 0) + amount;
    await freshUser.save();
    await Transaction.create({ userId: req.user._id, type: 'credit', amount, balanceAfter: freshUser.balance, reference: 'MOCK-TOPUP' });
    req.user.balance = freshUser.balance;
    return res.render('fragments/balance', { layout: false, balance: freshUser.balance, error: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
