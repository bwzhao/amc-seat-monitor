const { fetch } = require('undici');
const config = require('../config');

/**
 * Send a push notification via PushPlus (推送加) to WeChat.
 * Docs: https://www.pushplus.plus/doc/guide/api.html
 */
async function send(title, body) {
  if (!config.pushplusToken) return { success: false, error: 'No PushPlus token' };

  try {
    const res = await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: config.pushplusToken,
        title: title.slice(0, 100),
        content: body,
        template: 'markdown',
        channel: 'wechat',
      }),
    });
    const data = await res.json();
    return { success: data.code === 200, error: data.msg };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { send };
