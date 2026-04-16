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
  console.log(`[Email] Attempting to send to ${config.notifyEmail || '(not set)'} via ${config.smtpHost || '(not set)'}`);

  if (!config.notifyEmail || !config.smtpHost) {
    console.log('[Email] SKIP: NOTIFY_EMAIL or SMTP_HOST not configured');
    return { success: false, error: 'Email not configured' };
  }

  const t = getTransporter();
  if (!t) {
    console.log('[Email] SKIP: transporter failed to create');
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    const htmlBody = body
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');

    const info = await t.sendMail({
      from: config.smtpUser,
      to: config.notifyEmail,
      subject: title,
      html: `<div style="font-family:sans-serif;max-width:500px">${htmlBody}</div>`,
    });
    console.log(`[Email] SENT: ${info.messageId} to ${config.notifyEmail}`);
    return { success: true };
  } catch (err) {
    console.error(`[Email] FAILED: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = { send };
