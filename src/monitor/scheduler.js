const cron = require('node-cron');
const store = require('./store');
const { checkMonitor } = require('./checker');

let task = null;

function startScheduler() {
  // Run every minute, check which monitors are due
  task = cron.schedule('* * * * *', async () => {
    const monitors = store.getActiveMonitors();
    if (monitors.length === 0) return;

    const now = Date.now();

    for (const m of monitors) {
      const lastCheck = m.last_checked_at
        ? new Date(m.last_checked_at).getTime()
        : 0;
      const interval = (m.poll_interval_minutes || 2) * 60 * 1000;

      if (now - lastCheck >= interval) {
        await checkMonitor(m);
        // Small delay between monitors to avoid hammering AMC
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  });

  console.log('Seat monitor scheduler started');
}

function stopScheduler() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { startScheduler, stopScheduler };
