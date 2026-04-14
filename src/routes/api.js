const { Router } = require('express');
const amcClient = require('../amc/client');
const { analyzeSeats, analyzeAndScore } = require('../amc/seat-analyzer');
const { getDb } = require('../db');
const config = require('../config');
const pushplus = require('../notify/pushplus');
const serverchan = require('../notify/serverchan');
const bark = require('../notify/bark');

const router = Router();

router.get('/theatres', async (req, res) => {
  try {
    const theatres = await amcClient.getTheatres(req.query.q || '');
    res.json(theatres);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/movies', async (req, res) => {
  try {
    const movies = await amcClient.getMovies(req.query.theatre);
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/showtimes', async (req, res) => {
  try {
    const showtimes = await amcClient.getShowtimes(
      req.query.theatre,
      req.query.movie,
      req.query.date
    );
    res.json(showtimes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/seats', async (req, res) => {
  try {
    const layout = await amcClient.getSeatLayout(
      req.query.theatreId,
      req.query.showtimeId,
      req.query.amcShowtimeId
    );
    const result = analyzeSeats(layout.seats, {
      minRow: parseInt(req.query.minRow) || 5,
      centerBias: parseFloat(req.query.centerBias) || 0.33,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lightweight seat score endpoint (no grid, just score + top 5)
router.get('/seats/score', async (req, res) => {
  try {
    const layout = await amcClient.getSeatLayout(
      req.query.theatreId,
      req.query.showtimeId,
      req.query.amcShowtimeId
    );
    const result = analyzeAndScore(layout.seats, {
      centerBias: parseFloat(req.query.centerBias) || 0.33,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings
router.get('/settings', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  // Merge with env config (env takes precedence for secrets, DB for overrides)
  res.json({
    pushplusToken: settings.pushplusToken || config.pushplusToken,
    serverchanKey: settings.serverchanKey || config.serverchanKey,
    barkKey: settings.barkKey || config.barkKey,
    barkServer: settings.barkServer || config.barkServer,
    amcApiKey: settings.amcApiKey || config.amcApiKey,
    mode: amcClient.getMode(),
  });
});

router.post('/settings', (req, res) => {
  const db = getDb();
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const allowed = ['pushplusToken', 'serverchanKey', 'barkKey', 'barkServer', 'amcApiKey'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      upsert.run(key, req.body[key]);
      // Also update runtime config
      if (key in config) config[key] = req.body[key];
    }
  }
  res.json({ ok: true });
});

router.post('/settings/test-notify', async (req, res) => {
  const { channel } = req.body;
  const title = 'AMC Seat Monitor Test';
  const body = 'If you see this, notifications are working!';
  let result;
  if (channel === 'pushplus') {
    result = await pushplus.send(title, body);
  } else if (channel === 'serverchan') {
    result = await serverchan.send(title, body);
  } else if (channel === 'bark') {
    result = await bark.send(title, body);
  } else {
    return res.status(400).json({ error: 'Unknown channel' });
  }
  res.json(result);
});

module.exports = router;
