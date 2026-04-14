const { fetch } = require('undici');
const config = require('../config');

async function send(title, body, url) {
  if (!config.barkKey) return { success: false, error: 'No Bark key' };

  try {
    const res = await fetch(`${config.barkServer}/${config.barkKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        url: url || '',
        group: 'amc-seats',
        level: 'timeSensitive',
      }),
    });
    const data = await res.json();
    return { success: data.code === 200, error: data.message };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { send };
