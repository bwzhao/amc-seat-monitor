require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  amcApiKey: process.env.AMC_API_KEY || '',
  pushplusToken: process.env.PUSHPLUS_TOKEN || '',
  serverchanKey: process.env.SERVERCHAN_KEY || '',
  barkKey: process.env.BARK_KEY || '',
  barkServer: process.env.BARK_SERVER || 'https://api.day.app',
  dbPath: require('path').join(__dirname, '..', 'data', 'amc.sqlite'),
};
