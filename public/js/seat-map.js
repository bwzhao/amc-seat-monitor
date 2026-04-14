/**
 * Draw a seat map on a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} grid - { rows, rowLabels, colCount }
 * @param {Object} opts - { minRow, centerBias }
 */
function drawSeatMap(canvas, grid, opts) {
  if (!grid || !grid.rows || grid.rows.length === 0) return;

  const CELL = 18;
  const GAP = 3;
  const LABEL_W = 28;
  const STEP = CELL + GAP;
  const minRow = opts.minRow || 5;
  const centerBias = opts.centerBias || 0;

  // Calculate center column range
  const allCols = [];
  grid.rows.forEach(row => row.forEach((s, i) => { if (s && s.display) allCols.push(i); }));
  const minCol = Math.min(...allCols);
  const maxCol = Math.max(...allCols);
  const colRange = maxCol - minCol + 1;
  const margin = Math.floor(colRange * centerBias);
  const centerMin = minCol + margin;
  const centerMax = maxCol - margin;

  const width = LABEL_W + grid.colCount * STEP + 10;
  const height = grid.rows.length * STEP + 30;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  // Screen
  ctx.fillStyle = '#4a5568';
  ctx.fillRect(LABEL_W, 2, grid.colCount * STEP - GAP, 4);
  ctx.fillStyle = '#718096';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCREEN', LABEL_W + (grid.colCount * STEP) / 2, 14);

  const startY = 22;

  grid.rows.forEach((row, ri) => {
    const rowLabel = grid.rowLabels[ri];
    const rowIdx = rowToIdx(rowLabel);
    const y = startY + ri * STEP;

    // Row label
    ctx.fillStyle = '#a0aec0';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(rowLabel, LABEL_W - 6, y + CELL - 4);

    row.forEach((seat, ci) => {
      if (!seat || !seat.display) return;
      const x = LABEL_W + ci * STEP;

      let color;
      if (seat.type === 'NotASeat' || seat.type === 'notaseat') return;

      if (!seat.available) {
        color = '#4a5568'; // taken
      } else {
        const isGoodRow = rowIdx >= minRow;
        const isCenter = centerBias === 0 || (ci >= centerMin && ci <= centerMax);
        if (isGoodRow && isCenter) {
          color = '#48bb78'; // green - good seat
        } else {
          color = '#4299e1'; // blue - available but not "good"
        }
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, CELL, CELL, 3);
      ctx.fill();
    });
  });

  // Store grid data for re-render on preference change
  canvas.dataset.hasMap = '1';
  canvas.dataset.grid = JSON.stringify(grid);
}

function rowToIdx(label) {
  const s = String(label).trim().toUpperCase();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  let idx = 0;
  for (const ch of s) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx;
}

// Polyfill roundRect for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}
