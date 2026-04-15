const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (!transporter && config.smtpHost) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
  }
  return transporter;
}

async function send(title, body) {
  if (!config.notifyEmail || !config.smtpHost) {
    return { success: false, error: 'Email not configured' };
  }

  const t = getTransporter();
  if (!t) return { success: false, error: 'SMTP not configured' };

  try {
    // Convert markdown-style bold to HTML
    const htmlBody = body
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');

    await t.sendMail({
      from: config.smtpUser,
      to: config.notifyEmail,
      subject: title,
      html: `<div style="font-family:sans-serif;max-width:500px">${htmlBody}</div>`,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { send };
