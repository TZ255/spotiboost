function normalizePhone(raw) {
  if (!raw) return { valid: false, reason: 'Namba ya simu ni lazima.' };
  const phone = String(raw).replace(/\s|-/g, '');
  // +255XXXXXXXXX (13 chars total)
  if (/^\+255\d{9}$/.test(phone)) return { valid: true, format: '+255', phone, normalized: phone };
  // 255XXXXXXXXX (12 chars total)
  if (/^255\d{9}$/.test(phone)) return { valid: true, format: '255', phone, normalized: `+${phone}` };
  // 0XXXXXXXXX (10 chars total) -> +255 + 9 digits
  if (/^0\d{9}$/.test(phone)) return { valid: true, format: '0', phone, normalized: `+255${phone.slice(1)}` };
  // Helpful errors
  if (phone.startsWith('+255')) return { valid: false, reason: 'Namba ya simu ya +255 lazima iwe herufi 13.' };
  if (phone.startsWith('255')) return { valid: false, reason: 'Namba ya simu ya 255 lazima iwe herufi 12.' };
  if (phone.startsWith('0')) return { valid: false, reason: 'Namba ya simu ya 0 lazima iwe herufi 10.' };
  return { valid: false, reason: 'Tumia namba inayoanza na +255, 255 au 0.' };
}

module.exports = { normalizePhone };
