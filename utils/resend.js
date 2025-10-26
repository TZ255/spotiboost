const axios = require('axios');

async function sendPasswordResetEmail(toEmail, resetLink) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = 'Spoti Boost <no-reply@spoti.co.tz>';
  if (!apiKey) {
    console.warn('RESEND_API_KEY missing; skipping email send.');
    return false;
  }
  const payload = {
    from,
    to: toEmail,
    subject: 'Weka upya nenosiri lako',
    html: `<p>Habari,</p><p>Ili kuweka upya nenosiri, bofya kiungo hiki: <a href="${resetLink}">${resetLink}</a></p><p>Kiungo kinaisha muda baada ya saa 1.</p>`
  };

  try {
    await axios.post('https://api.resend.com/emails', payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return true;
  } catch (err) {
    console.error('Resend error:', err.response?.data || err.message);
    return false;
  }
}

module.exports = { sendPasswordResetEmail };

