const { getDb } = require('../db');

function createMonitor(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO monitors (theatre_id, theatre_name, theatre_slug, movie_id, movie_title,
      showtime_id, showtime_display, showtime_datetime, showtime_url,
      min_row, center_bias, poll_interval_minutes, notify_email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.theatreId, data.theatreName, data.theatreSlug,
    data.movieId, data.movieTitle,
    data.showtimeId, data.showtimeDisplay, data.showtimeDatetime, data.showtimeUrl,
    data.minRow ?? 5, data.centerBias ?? 0.33, data.pollInterval ?? 2,
    data.notifyEmail !== undefined ? (data.notifyEmail ? 1 : 0) : 1
  );
  return result.lastInsertRowid;
}

function getActiveMonitors() {
  return getDb()
    .prepare('SELECT * FROM monitors WHERE is_active = 1')
    .all();
}

function getMonitor(id) {
  return getDb().prepare('SELECT * FROM monitors WHERE id = ?').get(id);
}

function getAllMonitors() {
  return getDb()
    .prepare('SELECT * FROM monitors ORDER BY created_at DESC')
    .all();
}

function updateLastChecked(id) {
  getDb()
    .prepare("UPDATE monitors SET last_checked_at = datetime('now') WHERE id = ?")
    .run(id);
}

function updateLastNotified(id) {
  getDb()
    .prepare("UPDATE monitors SET last_notified_at = datetime('now') WHERE id = ?")
    .run(id);
}

function updateMonitor(id, data) {
  const db = getDb();
  const fields = [];
  const values = [];
  if (data.pollInterval !== undefined) { fields.push('poll_interval_minutes = ?'); values.push(data.pollInterval); }
  if (data.minRow !== undefined) { fields.push('min_row = ?'); values.push(data.minRow); }
  if (data.centerBias !== undefined) { fields.push('center_bias = ?'); values.push(data.centerBias); }
  if (data.notifyEmail !== undefined) { fields.push('notify_email = ?'); values.push(data.notifyEmail ? 1 : 0); }
  if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE monitors SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function deactivateMonitor(id) {
  getDb()
    .prepare('UPDATE monitors SET is_active = 0 WHERE id = ?')
    .run(id);
}

function deleteMonitor(id) {
  const db = getDb();
  db.prepare('DELETE FROM seat_snapshots WHERE monitor_id = ?').run(id);
  db.prepare('DELETE FROM notifications WHERE monitor_id = ?').run(id);
  db.prepare('DELETE FROM monitors WHERE id = ?').run(id);
}

function saveSnapshot(monitorId, goodSeatsJson, totalAvailable) {
  getDb()
    .prepare(
      'INSERT INTO seat_snapshots (monitor_id, good_seats_json, total_available) VALUES (?, ?, ?)'
    )
    .run(monitorId, goodSeatsJson, totalAvailable);
}

function getLastSnapshot(monitorId) {
  return getDb()
    .prepare(
      'SELECT * FROM seat_snapshots WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1'
    )
    .get(monitorId);
}

function getNotifications(monitorId, limit = 20) {
  return getDb()
    .prepare(
      'SELECT * FROM notifications WHERE monitor_id = ? ORDER BY sent_at DESC LIMIT ?'
    )
    .all(monitorId, limit);
}

module.exports = {
  createMonitor, getActiveMonitors, getMonitor, getAllMonitors,
  updateMonitor, updateLastChecked, updateLastNotified, deactivateMonitor, deleteMonitor,
  saveSnapshot, getLastSnapshot, getNotifications,
};
