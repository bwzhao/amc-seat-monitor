const { Router } = require('express');
const router = Router();

router.get('/', (req, res) => res.render('home', { title: 'Home' }));
router.get('/theatres', (req, res) => res.render('theatres', { title: 'Theatres', query: req.query.q || '' }));
router.get('/movies', (req, res) => res.render('movies', { title: 'Movies' }));
router.get('/showtimes', (req, res) => res.render('showtimes', { title: 'Showtimes' }));
router.get('/monitor/new', (req, res) => res.render('monitor-new', { title: 'New Monitor' }));
router.get('/dashboard', (req, res) => res.render('dashboard', { title: 'Dashboard' }));
router.get('/settings', (req, res) => res.render('settings', { title: 'Settings' }));

module.exports = router;
