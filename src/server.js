const express = require('express');
const path = require('path');
const config = require('./config');
const { getDb } = require('./db');
const pagesRouter = require('./routes/pages');
const apiRouter = require('./routes/api');
const monitorRouter = require('./routes/monitor');
const { startScheduler } = require('./monitor/scheduler');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Simple template engine
app.engine('html', (filePath, options, callback) => {
  const fs = require('fs');
  const layoutPath = path.join(__dirname, 'views', 'layout.html');
  const layout = fs.readFileSync(layoutPath, 'utf8');
  const content = fs.readFileSync(filePath, 'utf8');

  let html = layout.replace('{{content}}', content);
  // Replace all {{key}} placeholders
  for (const [key, value] of Object.entries(options)) {
    if (typeof value === 'string' || typeof value === 'number') {
      html = html.split(`{{${key}}}`).join(String(value));
    }
  }
  // Clean up unreplaced placeholders
  html = html.replace(/\{\{[^}]+\}\}/g, '');
  callback(null, html);
});
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');

// Routes
app.use('/', pagesRouter);
app.use('/api', apiRouter);
app.use('/api/monitors', monitorRouter);

// Init DB and start
getDb();
startScheduler();

app.listen(config.port, () => {
  const mode = config.amcApiKey ? 'API' : 'Scrape';
  const email = config.notifyEmail && config.smtpHost ? `Email → ${config.notifyEmail}` : 'Email OFF';
  const push = config.pushplusToken ? 'PushPlus ON' : 'PushPlus OFF';
  console.log(`AMC Seat Monitor running on http://localhost:${config.port} [${mode} mode] [${email}] [${push}]`);
});
