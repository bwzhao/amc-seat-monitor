require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  amcApiKey: process.env.AMC_API_KEY || '',
  pushplusToken: process.env.PUSHPLUS_TOKEN || '',
  serverchanKey: process.env.SERVERCHAN_KEY || '',
  barkKey: process.env.BARK_KEY || '',
  barkServer: process.env.BARK_SERVER || 'https://api.day.app',
  notifyEmail: process.env.NOTIFY_EMAIL || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  dbPath: require('path').join(__dirname, '..', 'data', 'amc.sqlite'),
};
