import { Resend } from 'resend';

const OWNER_EMAIL = 'ai@pt-solutions.tech';
const FROM_NOTIFICATION = `PT Solutions Contact <${OWNER_EMAIL}>`;
const FROM_CONFIRMATION = `Petr Šimůnek <${OWNER_EMAIL}>`;

const MAX_NAME = 200;
const MAX_EMAIL = 200;
const MAX_PROBLEM = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'invalid_body' });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const problem = typeof body.problem === 'string' ? body.problem.trim() : '';

  if (!name || !email || !problem) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (name.length > MAX_NAME || email.length > MAX_EMAIL || problem.length > MAX_PROBLEM) {
    return res.status(400).json({ error: 'field_too_long' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'send_failed' });
  }

  const resend = new Resend(apiKey);

  const notification = {
    from: FROM_NOTIFICATION,
    to: OWNER_EMAIL,
    replyTo: email,
    subject: `New signal from ${name}`,
    text:
      `New contact form submission.\n\n` +
      `Name:    ${name}\n` +
      `Email:   ${email}\n\n` +
      `Message:\n${problem}\n`,
    html:
      `<p><strong>New contact form submission.</strong></p>` +
      `<p><strong>Name:</strong> ${escapeHtml(name)}<br />` +
      `<strong>Email:</strong> ${escapeHtml(email)}</p>` +
      `<p><strong>Message:</strong></p>` +
      `<p>${escapeHtml(problem).replace(/\n/g, '<br />')}</p>`,
  };

  const confirmation = {
    from: FROM_CONFIRMATION,
    to: email,
    replyTo: OWNER_EMAIL,
    subject: 'Signal received — thanks',
    text:
      `Thanks ${name} — your signal landed.\n\n` +
      `I'll review and reply personally. The interesting problems always get answered first.\n\n` +
      `— Petr`,
    html:
      `<p>Thanks ${escapeHtml(name)} — your signal landed.</p>` +
      `<p>I'll review and reply personally. The interesting problems always get answered first.</p>` +
      `<p>— Petr</p>`,
  };

  try {
    const [notifRes, confRes] = await Promise.all([
      resend.emails.send(notification),
      resend.emails.send(confirmation),
    ]);
    if (notifRes?.error || confRes?.error) {
      console.error('Resend send error', { notif: notifRes?.error, conf: confRes?.error });
      return res.status(500).json({ error: 'send_failed' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend threw', err);
    return res.status(500).json({ error: 'send_failed' });
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
