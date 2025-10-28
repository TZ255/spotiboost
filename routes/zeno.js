const router = require('express').Router();
const PaymentBin = require('../models/PaymentBin');
const { isValidPhoneNumber } = require('tanzanian-phone-validator');
const { makePayment, getTransactionStatus } = require('../utils/zenopay');
const { ensureAuth } = require('../middlewares/authCheck');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// helpers
const BASE_URL = process.env.DOMAIN;
const webhook_url = `https://${BASE_URL}/zeno/zenopay-webhook`;
const generateOrderId = (seed) => `SPOTIORD-${Date.now().toString(36).toUpperCase()}-${seed}`;


// Start payment from Add Funds form (HTMX)
router.post('/pay', ensureAuth, async (req, res) => {
  try {
    const email = String(req.user?.email || '').trim().toLowerCase();
    const amount = Number(req.body?.amount);
    const phone9 = String(req.body?.phone9 || '').trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.render('fragments/payments/payment-error', { layout: false, message: 'Barua pepe si sahihi. Tafadhali ingia tena.' });
    }
    if (!Number.isFinite(amount) || amount < 500) {
      return res.render('fragments/payments/payment-error', { layout: false, message: 'Kiasi lazima kiwe angalau TZS 100.' });
    }
    // Phone: user-entered 9 digits (no leading 0); validate as Tanzanian when prefixed with 255
    if (!/^([1-9][0-9]{8})$/.test(phone9)) {
      return res.render('fragments/payments/payment-form-error', { layout: false, message: 'Namba ya simu si sahihi. Weka tarakimu 9 bila kuanza na 0.' });
    }
    const msisdn = `255${phone9}`;
    if (!isValidPhoneNumber(msisdn)) {
      return res.render('fragments/payments/payment-form-error', { layout: false, message: 'Namba ya simu si sahihi. Hakikisha ni ya Tanzania.' });
    }

    const order_id = generateOrderId(phone9);

    await PaymentBin.create({
      email,
      phone: msisdn,
      orderId: order_id,
      payment_status: 'PENDING',
      meta: { gateway: 'ZenoPay', amount },
      updatedAt: new Date(),
    });

    const payload = {
      order_id,
      buyer_name: (req.user?.name || email.split('@')[0]).slice(0, 60),
      buyer_phone: msisdn,
      buyer_email: email,
      amount,
      webhook_url,
      metadata: { amount },
    };

    const apiResp = await makePayment(payload);
    if (!apiResp || apiResp.status !== 'success') {
      return res.render('fragments/payments/payment-error', { layout: false, message: apiResp?.message || 'Imeshindikana kuanzisha malipo. Jaribu tena.' });
    }

    return res.render('fragments/payments/payment-initiated', {
      layout: false,
      orderId: apiResp.order_id || order_id,
      phone: `+${msisdn}`,
      amount,
    });
  } catch (error) {
    const msg = (error && error.message && /timed out/i.test(error.message))
      ? 'Ombi la malipo limechelewa. Tafadhali jaribu tena.'
      : 'Hitilafu imetokea. Tafadhali jaribu tena.';
    return res.render('fragments/payments/payment-error', { layout: false, message: msg });
  }
});

// ZenoPay webhook (credits balance on completion)
router.post('/zenopay-webhook', async (req, res) => {
  try {
    const { order_id, payment_status, reference } = req.body || {};
    if (!order_id) return res.sendStatus(200);

    const record = await PaymentBin.findOne({ orderId: order_id });
    if (!record) return res.sendStatus(200);

    // Update record
    record.payment_status = payment_status || record.payment_status;
    record.reference = reference || record.reference;
    record.updatedAt = new Date();
    await record.save();

    if (payment_status === 'COMPLETED') {
      try {
        const status = await getTransactionStatus(order_id);
        // Try to read amount from potential array/object shapes
        const data = status?.data || status || {};
        const first = Array.isArray(data) ? data[0] : (Array.isArray(data?.data) ? data.data[0] : data);
        const amountStr = first?.amount || status?.amount || 0;
        const amount = Number(amountStr) || 0;
        if (amount > 0) {
          const user = await User.findOne({ email: record.email });
          if (user) {
            user.balance = (user.balance || 0) + amount;
            await user.save();
            await Transaction.create({
              userId: user._id,
              type: 'credit',
              amount,
              balanceAfter: user.balance,
              reference: 'ZENO:' + (record.reference || 'PUSH'),
            });
          }
        }
      } catch (e) {
        // swallow to keep webhook 200
        console.error('Webhook credit error:', e?.message || e);
      }
    }
    return res.sendStatus(200);
  } catch (error) {
    console.error('WEBHOOK error:', error?.message || error);
    return res.sendStatus(200);
  }
});

module.exports = router
