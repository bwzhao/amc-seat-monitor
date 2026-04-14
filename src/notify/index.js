const pushplus = require('./pushplus');
const serverchan = require('./serverchan');
const bark = require('./bark');
const config = require('../config');
const { getDb } = require('../db');

async function notify(monitorId, title, body, bookingUrl) {
  const results = [];

  // PushPlus (primary WeChat push)
  if (config.pushplusToken) {
    const r = await pushplus.send(title, body);
    logNotification(monitorId, 'pushplus', title, body, r.success);
    results.push({ channel: 'pushplus', ...r });
  }

  // ServerChan (legacy WeChat push)
  if (config.serverchanKey) {
    const r = await serverchan.send(title, body);
    logNotification(monitorId, 'serverchan', title, body, r.success);
    results.push({ channel: 'serverchan', ...r });
  }

  // Bark (iOS push)
  if (config.barkKey) {
    const r = await bark.send(title, body, bookingUrl);
    logNotification(monitorId, 'bark', title, body, r.success);
    results.push({ channel: 'bark', ...r });
  }

  return results;
}

function logNotification(monitorId, channel, title, body, success) {
  try {
    getDb()
      .prepare(
        'INSERT INTO notifications (monitor_id, channel, title, body, success) VALUES (?, ?, ?, ?, ?)'
      )
      .run(monitorId, channel, title, body, success ? 1 : 0);
  } catch (err) {
    console.error('Failed to log notification:', err.message);
  }
}

module.exports = { notify };
