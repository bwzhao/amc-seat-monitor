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

    // No seats at all → skip
    if (result.totalAvailable === 0) {
      console.log(`Monitor #${monitor.id}: sold out`);
      return;
    }

    // Cooldown — don't spam
    if (monitor.last_notified_at) {
      const elapsed = Date.now() - new Date(monitor.last_notified_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        console.log(`Monitor #${monitor.id}: ${result.totalAvailable} avail (cooldown)`);
        return;
      }
    }

    // Seats available → notify
    const seatList = result.top5.map((s) => s.seatName).join(', ');

    const title = `${result.totalAvailable} Seats - ${monitor.movie_title}`;
    const body = [
      `**${monitor.movie_title}** at **${monitor.theatre_name}**`,
      `Showtime: ${monitor.showtime_display}`,
      `Total available: ${result.totalAvailable}`,
      `Top seats: ${seatList}`,
      monitor.showtime_url
        ? `[Book now](https://www.amctheatres.com${monitor.showtime_url})`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const bookingUrl = monitor.showtime_url
      ? `https://www.amctheatres.com${monitor.showtime_url}`
      : '';

    if (monitor.notify_email) {
      await notify(monitor.id, title, body, bookingUrl);
      store.updateLastNotified(monitor.id);
      console.log(`Monitor #${monitor.id}: notified! ${result.totalAvailable} seats`);
    } else {
      console.log(`Monitor #${monitor.id}: ${result.totalAvailable} seats (notifications off)`);
    }
  } catch (err) {
    console.error(`Monitor #${monitor.id} check failed:`, err.message);
  }
}

module.exports = { checkMonitor };
