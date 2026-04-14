const config = require('../config');

let apiStrategy = null;
let scrapeStrategy = null;

function getApiStrategy() {
  if (!apiStrategy) apiStrategy = require('./api-strategy');
  return apiStrategy;
}

function getScrapeStrategy() {
  if (!scrapeStrategy) scrapeStrategy = require('./scrape-strategy');
  return scrapeStrategy;
}

function hasApiKey() {
  return !!config.amcApiKey;
}

module.exports = {
  // Use API when key is available (fast, reliable), fallback to scrape
  getTheatres: (...args) =>
    hasApiKey()
      ? getApiStrategy().getTheatres(...args)
      : getScrapeStrategy().getTheatres(...args),

  getMovies: (...args) =>
    hasApiKey()
      ? getApiStrategy().getMovies(...args)
      : getScrapeStrategy().getMovies(...args),

  getShowtimes: (...args) =>
    hasApiKey()
      ? getApiStrategy().getShowtimes(...args)
      : getScrapeStrategy().getShowtimes(...args),

  // Seat layout: always use Puppeteer (AMC API requires ecommerce access for seating)
  getSeatLayout: async (theatreId, performanceNumber, amcShowtimeId) => {
    const showtimeId = amcShowtimeId || performanceNumber;
    return getScrapeStrategy().getSeatLayout(theatreId, showtimeId);
  },

  getMode: () => (config.amcApiKey ? 'api' : 'scrape'),
};
