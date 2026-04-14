CREATE TABLE IF NOT EXISTS monitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theatre_id TEXT NOT NULL,
  theatre_name TEXT NOT NULL,
  theatre_slug TEXT,
  movie_id TEXT,
  movie_title TEXT,
  showtime_id TEXT NOT NULL,
  showtime_display TEXT NOT NULL,
  showtime_datetime TEXT NOT NULL,
  showtime_url TEXT,
  min_row INTEGER DEFAULT 5,
  center_bias REAL DEFAULT 0.33,
  poll_interval_minutes INTEGER DEFAULT 2,
  is_active INTEGER DEFAULT 1,
  last_checked_at TEXT,
  last_notified_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seat_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  good_seats_json TEXT NOT NULL,
  total_available INTEGER NOT NULL,
  checked_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  sent_at TEXT DEFAULT (datetime('now')),
  success INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
