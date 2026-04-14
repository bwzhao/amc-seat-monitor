const amcClient = require('../amc/client');
const { analyzeAndScore } = require('../amc/seat-analyzer');
const store = require('./store');
const { notify } = require('../notify');

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

async function checkMonitor(monitor) {
  try {
    // Auto-deactivate if showtime has passed
    if (new Date(monitor.showtime_datetime) < new Date()) {
      store.deactivateMonitor(monitor.id);
      console.log(`Monitor #${monitor.id} deactivated (showtime passed)`);
      return;
    }

    // Extract AMC showtime ID from the stored URL (e.g., /showtimes/141187650)
    const amcShowtimeId = monitor.showtime_url
      ? monitor.showtime_url.split('/').pop()
      : monitor.showtime_id;
    const layout = await amcClient.getSeatLayout(
      monitor.theatre_id,
      monitor.showtime_id,
      amcShowtimeId
    );

    const result = analyzeAndScore(layout.seats, {
      centerBias: monitor.center_bias,
      skipFrontRows: monitor.min_row || 0,
    });

    store.updateLastChecked(monitor.id);
    store.saveSnapshot(
      monitor.id,
      JSON.stringify(result.top5),
      result.totalAvailable
    );

    if (result.top5.length === 0) {
      console.log(`Monitor #${monitor.id}: no seats available`);
      return;
    }

    // Check for new seats vs last notification
    const lastSnapshot = store.getLastSnapshot(monitor.id);
    const prevSeats = lastSnapshot
      ? new Set(JSON.parse(lastSnapshot.good_seats_json).map(s => s.seatName))
      : new Set();

    const newSeats = result.top5.filter(s => !prevSeats.has(s.seatName));

    if (newSeats.length === 0 && prevSeats.size > 0) {
      console.log(`Monitor #${monitor.id}: score ${result.score} ${result.label} (no new seats)`);
      return;
    }

    // Cooldown check
    if (monitor.last_notified_at) {
      const elapsed = Date.now() - new Date(monitor.last_notified_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        console.log(`Monitor #${monitor.id}: cooldown active`);
        return;
      }
    }

    // Send notification
    const seatList = result.top5.map((s) => s.seatName).join(', ');

    const title = `Score ${result.score} ${result.label} - ${monitor.movie_title}`;
    const body = [
      `**${monitor.movie_title}** at **${monitor.theatre_name}**`,
      `Showtime: ${monitor.showtime_display}`,
      `Score: **${result.score}/100** (${result.label})`,
      `Best seats: ${seatList}`,
      `Total available: ${result.totalAvailable}`,
      monitor.showtime_url
        ? `[Book now](https://www.amctheatres.com${monitor.showtime_url})`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const bookingUrl = monitor.showtime_url
      ? `https://www.amctheatres.com${monitor.showtime_url}`
      : '';

    await notify(monitor.id, title, body, bookingUrl);
    store.updateLastNotified(monitor.id);
    console.log(`Monitor #${monitor.id}: notified! ${result.goodSeats.length} good seats`);
  } catch (err) {
    console.error(`Monitor #${monitor.id} check failed:`, err.message);
  }
}

module.exports = { checkMonitor };
