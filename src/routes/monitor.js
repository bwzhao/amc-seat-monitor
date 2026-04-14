const { Router } = require('express');
const store = require('../monitor/store');
const { checkMonitor } = require('../monitor/checker');

const router = Router();

// List all monitors with latest snapshot
router.get('/', (req, res) => {
  const monitors = store.getAllMonitors();
  const result = monitors.map((m) => {
    const snap = store.getLastSnapshot(m.id);
    return {
      ...m,
      lastScore: snap ? JSON.parse(snap.good_seats_json) : null,
      lastTotalAvailable: snap ? snap.total_available : null,
    };
  });
  res.json(result);
});

// Create monitor
router.post('/', (req, res) => {
  try {
    const id = store.createMonitor(req.body);
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual check
router.post('/:id/check', async (req, res) => {
  const monitor = store.getMonitor(parseInt(req.params.id));
  if (!monitor) return res.status(404).json({ error: 'Not found' });

  try {
    const amcClient = require('../amc/client');
    const { analyzeAndScore } = require('../amc/seat-analyzer');
    const amcShowtimeId = monitor.showtime_url ? monitor.showtime_url.split('/').pop() : monitor.showtime_id;
    const layout = await amcClient.getSeatLayout(monitor.theatre_id, monitor.showtime_id, amcShowtimeId);
    const result = analyzeAndScore(layout.seats, {
      centerBias: monitor.center_bias,
      skipFrontRows: monitor.min_row || 0,
    });
    store.updateLastChecked(monitor.id);
    store.saveSnapshot(monitor.id, JSON.stringify(result.top5), result.totalAvailable);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update monitor settings
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const monitor = store.getMonitor(id);
  if (!monitor) return res.status(404).json({ error: 'Not found' });
  store.updateMonitor(id, req.body);
  res.json({ ok: true });
});

// Stop monitor
router.post('/:id/stop', (req, res) => {
  store.deactivateMonitor(parseInt(req.params.id));
  res.json({ ok: true });
});

// Delete monitor
router.delete('/:id', (req, res) => {
  store.deleteMonitor(parseInt(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
