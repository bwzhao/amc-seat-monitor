const EXCLUDE_TYPES = ['NotASeat', 'Companion', 'Wheelchair', 'notaseat', 'NA', 'Blocked'];

// Convert row label to numeric index (A=1, B=2, ..., or numeric string)
function rowToIndex(row) {
  if (typeof row === 'number') return row;
  const s = String(row).trim().toUpperCase();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  let idx = 0;
  for (const ch of s) {
    idx = idx * 26 + (ch.charCodeAt(0) - 64);
  }
  return idx;
}

/**
 * Analyze seats and find "best" ones.
 *
 * Best seats = center columns in the back half of the theater.
 * This is the sweet spot for picture framing and surround sound.
 *
 * @param {Array} seats - Array of seat objects from AMC
 * @param {Object} opts
 * @param {number} opts.centerBias - 0-0.5, fraction of columns to exclude on each side (default 0.33)
 * @returns {{ goodSeats: Array, totalAvailable: number, grid: Object }}
 */
function analyzeSeats(seats, opts = {}) {
  const centerBias = opts.centerBias ?? 0.33;

  // Filter displayable seats
  const displayable = seats.filter(
    (s) => s.shouldDisplay !== false && !EXCLUDE_TYPES.includes(s.type)
  );

  if (displayable.length === 0) {
    return { goodSeats: [], totalAvailable: 0, grid: buildGrid(seats) };
  }

  // Determine row range for "back half"
  const rowIndices = displayable.map((s) => rowToIndex(s.row));
  const minRowIdx = Math.min(...rowIndices);
  const maxRowIdx = Math.max(...rowIndices);
  const totalRows = maxRowIdx - minRowIdx + 1;
  // Back half = rows in the upper 50% of the theater
  const backHalfStart = minRowIdx + Math.ceil(totalRows / 2);

  // Determine column range for center filtering
  const columns = displayable.map((s) => s.column);
  const minCol = Math.min(...columns);
  const maxCol = Math.max(...columns);
  const colRange = maxCol - minCol + 1;
  const margin = Math.floor(colRange * centerBias);
  const centerMin = minCol + margin;
  const centerMax = maxCol - margin;

  const available = displayable.filter((s) => s.available);
  const totalAvailable = available.length;

  const goodSeats = available.filter((s) => {
    const rowIdx = rowToIndex(s.row);
    // Must be in back half
    if (rowIdx < backHalfStart) return false;
    // Must be in center columns
    if (centerBias > 0 && (s.column < centerMin || s.column > centerMax)) return false;
    return true;
  });

  // Sort good seats by quality: closer to dead center and middle row is better
  const midRow = (backHalfStart + maxRowIdx) / 2;
  const midCol = (centerMin + centerMax) / 2;
  goodSeats.sort((a, b) => {
    const distA = Math.abs(rowToIndex(a.row) - midRow) + Math.abs(a.column - midCol) * 0.5;
    const distB = Math.abs(rowToIndex(b.row) - midRow) + Math.abs(b.column - midCol) * 0.5;
    return distA - distB;
  });

  return {
    goodSeats: goodSeats.map((s) => ({
      row: s.row,
      column: s.column,
      seatName: s.seatName,
      type: s.type,
    })),
    totalAvailable,
    grid: buildGrid(seats),
  };
}

// Build a 2D grid representation for the seat map
function buildGrid(seats) {
  if (seats.length === 0) return { rows: [], rowLabels: [], colCount: 0 };

  const rowMap = new Map();
  let maxCol = 0;

  for (const s of seats) {
    const rowKey = String(s.row);
    if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
    rowMap.get(rowKey).push(s);
    if (s.column > maxCol) maxCol = s.column;
  }

  const sortedKeys = [...rowMap.keys()].sort(
    (a, b) => rowToIndex(a) - rowToIndex(b)
  );

  const rows = sortedKeys.map((key) => {
    const rowSeats = rowMap.get(key);
    const cols = new Array(maxCol + 1).fill(null);
    for (const s of rowSeats) {
      cols[s.column] = {
        name: s.seatName,
        available: s.available,
        display: s.shouldDisplay !== false,
        type: s.type,
      };
    }
    return cols;
  });

  return { rows, rowLabels: sortedKeys, colCount: maxCol + 1 };
}

/**
 * Analyze seats and compute a quality score (0-100) + top 5 best seats.
 * Wraps analyzeSeats with scoring logic.
 */
function analyzeAndScore(seats, opts = {}) {
  const centerBias = opts.centerBias ?? 0.33;

  const displayable = seats.filter(
    (s) => s.shouldDisplay !== false && !EXCLUDE_TYPES.includes(s.type)
  );

  if (displayable.length === 0) {
    return { score: 0, label: 'No Seats', top5: [], totalAvailable: 0 };
  }

  // Recompute geometry (same as analyzeSeats)
  const rowIndices = displayable.map((s) => rowToIndex(s.row));
  const minRowIdx = Math.min(...rowIndices);
  const maxRowIdx = Math.max(...rowIndices);
  const totalRows = maxRowIdx - minRowIdx + 1;
  const backHalfStart = minRowIdx + Math.ceil(totalRows / 2);

  const columns = displayable.map((s) => s.column);
  const minCol = Math.min(...columns);
  const maxCol = Math.max(...columns);
  const colRange = maxCol - minCol + 1;
  const margin = Math.floor(colRange * centerBias);
  const centerMin = minCol + margin;
  const centerMax = maxCol - margin;

  const midRow = (backHalfStart + maxRowIdx) / 2;
  const midCol = (centerMin + centerMax) / 2;
  // Max possible distance (corner of the good zone)
  const maxDist =
    Math.abs(backHalfStart - midRow) +
    Math.abs(centerMin - midCol) * 0.5 +
    1;

  const available = displayable.filter((s) => s.available);
  const totalAvailable = available.length;

  if (totalAvailable === 0) {
    return { score: 0, label: 'Sold Out', top5: [], totalAvailable: 0 };
  }

  // Sort ALL available seats by distance to the ideal spot (center of back half)
  // This way we always have a top 5, even if no seats are in the sweet zone
  const sortedAvailable = [...available].sort((a, b) => {
    const distA =
      Math.abs(rowToIndex(a.row) - midRow) +
      Math.abs(a.column - midCol) * 0.5;
    const distB =
      Math.abs(rowToIndex(b.row) - midRow) +
      Math.abs(b.column - midCol) * 0.5;
    return distA - distB;
  });

  // Count how many are in the prime zone (center + back half)
  const goodCount = available.filter((s) => {
    const rowIdx = rowToIndex(s.row);
    if (rowIdx < backHalfStart) return false;
    if (centerBias > 0 && (s.column < centerMin || s.column > centerMax))
      return false;
    return true;
  }).length;

  // Score components
  // 1. Quantity (0-40): how many seats in the prime zone, capped at 20
  const qtyScore = Math.min(40, goodCount * 2);

  // 2. Quality (0-60): how close the best available seat is to dead center
  const bestDist =
    Math.abs(rowToIndex(sortedAvailable[0].row) - midRow) +
    Math.abs(sortedAvailable[0].column - midCol) * 0.5;
  const qualityScore = Math.max(0, Math.round(60 * (1 - bestDist / maxDist)));

  const score = Math.min(100, qtyScore + qualityScore);
  const label =
    score >= 80
      ? 'Excellent'
      : score >= 60
        ? 'Great'
        : score >= 40
          ? 'Good'
          : score >= 20
            ? 'Fair'
            : 'Poor';

  const top5 = sortedAvailable.slice(0, 5).map((s) => ({
    row: s.row,
    column: s.column,
    seatName: s.seatName,
  }));

  return { score, label, top5, totalAvailable };
}

module.exports = { analyzeSeats, analyzeAndScore, rowToIndex };
