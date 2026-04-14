const { fetch } = require('undici');
const config = require('../config');

async function send(title, body) {
  if (!config.serverchanKey) return { success: false, error: 'No ServerChan key' };

  try {
    const res = await fetch(
      `https://sctapi.ftqq.com/${config.serverchanKey}.send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.slice(0, 32), desp: body }),
      }
    );
    const data = await res.json();
    return { success: data.code === 0, error: data.message };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { send };
