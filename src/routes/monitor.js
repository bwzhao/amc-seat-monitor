const { Router } = require('express');
const store = require('../monitor/store');
const { checkMonitor } = require('../monitor/checker');

const router = Router();

// List all monitors
router.get('/', (req, res) => {
  res.json(store.getAllMonitors());
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
    const { analyzeSeats } = require('../amc/seat-analyzer');
    const amcShowtimeId = monitor.showtime_url ? monitor.showtime_url.split('/').pop() : monitor.showtime_id;
    const layout = await amcClient.getSeatLayout(monitor.theatre_id, monitor.showtime_id, amcShowtimeId);
    const result = analyzeSeats(layout.seats, {
      minRow: monitor.min_row,
      centerBias: monitor.center_bias,
    });
    store.updateLastChecked(monitor.id);
    store.saveSnapshot(monitor.id, JSON.stringify(result.goodSeats), result.totalAvailable);
    res.json({ goodSeats: result.goodSeats.length, totalAvailable: result.totalAvailable, seats: result.goodSeats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
