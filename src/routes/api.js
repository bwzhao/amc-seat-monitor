const { Router } = require('express');
const amcClient = require('../amc/client');
const { analyzeSeats, analyzeAndScore } = require('../amc/seat-analyzer');

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
      centerBias: parseFloat(req.query.centerBias) || 0.33,
      skipFrontRows: parseInt(req.query.skipFrontRows) || 0,
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
      skipFrontRows: parseInt(req.query.skipFrontRows) || 0,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
