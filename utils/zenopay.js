const axios = require('axios')

const PAY_URL = 'https://zenoapi.com/api/payments/mobile_money_tanzania';
const STATUS_URL = 'https://zenoapi.com/api/payments/order-status';

// Create a payment with ZenoPay
// Params: { order_id, buyer_name, buyer_phone, buyer_email, amount, webhook_url, metadata }
const makePayment = async (payload) => {
    const apiKey = process.env.ZENO_API_KEY || process.env.ZENOPAY_API_KEY || "";
    const TIMEOUT = 90000; // 90 seconds

    try {
        const res = await axios.post(PAY_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            timeout: TIMEOUT
        });
        console.log('Payment req sent:', res.data)
        return res.data;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            throw new Error('Payment request timed out. Please try again.');
        }
        throw error;
    }
};


// Get transaction status by order_id
const getTransactionStatus = async (order_id) => {
    const apiKey = process.env.ZENO_API_KEY || process.env.ZENOPAY_API_KEY || "";
    const TIMEOUT = 120000; // 2 minutes
    try {
        const res = await axios.get(`${STATUS_URL}?order_id=${order_id}`, {
            headers: { 'x-api-key': apiKey }, timeout: TIMEOUT
        });
        return res.data;
    } catch (error) {
        throw error;
    }
}

// Example of response from getTransactionStatus
// {"reference":"0994780437","resultcode":"000","result":"SUCCESS","message":"Order fetch successful","data":[{"order_id":"ORD-mh243okd-757259678","creation_date":"2025-10-22 17:54:07","amount":"500","payment_status":"COMPLETED","transid":"CJM7KRW9AEZ","channel":"MPESA-TZ","reference":"0994780437","msisdn":"255757259678"}]}

module.exports = { makePayment, getTransactionStatus }
