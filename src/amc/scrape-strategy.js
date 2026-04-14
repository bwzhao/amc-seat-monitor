const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const BASE = 'https://www.amctheatres.com';

let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    const opts = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    };
    // Use system Chromium in Docker (set via PUPPETEER_EXECUTABLE_PATH)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      opts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browser = await puppeteer.launch(opts);
  }
  return browser;
}

async function withPage(fn) {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );
    return await fn(page);
  } finally {
    await page.close();
  }
}

async function getTheatres(query) {
  return withPage(async (page) => {
    await page.goto(`${BASE}/movie-theatres`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('input[placeholder*="Search by City"]', { timeout: 10000 });

    const input = await page.$('input[placeholder*="Search by City"]');
    await input.click();
    await input.type(query, { delay: 60 });
    await page.keyboard.press('Enter');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));

    return page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a[href*="/movie-theatres/"]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const name = a.textContent.trim();
        const slug = href.split('/').pop();
        if (
          name.length > 5 && name.length < 80 &&
          slug.startsWith('amc-') &&
          !results.find((r) => r.slug === slug)
        ) {
          // Extract market from URL: /movie-theatres/{market}/{slug}
          const parts = href.replace('/movie-theatres/', '').split('/');
          const market = parts.length > 1 ? parts[0] : '';
          results.push({ id: slug, name, slug, market, address: '', city: '', state: '', zipCode: '' });
        }
      });
      return results;
    });
  });
}

async function getMovies(theatreSlug) {
  return withPage(async (page) => {
    // theatreSlug might be just the slug or market/slug
    const path = theatreSlug.includes('/') ? theatreSlug : `new-york-city/${theatreSlug}`;
    await page.goto(`${BASE}/movie-theatres/${path}/showtimes`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 5000));

    return page.evaluate(() => {
      const movies = [];
      document.querySelectorAll('a[href*="/movies/"]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        const img = a.querySelector('img');
        const title = img
          ? img.getAttribute('alt') || ''
          : a.textContent.trim();
        const slug = href.replace(/.*\/movies\//, '').replace(/\/.*/, '');
        if (title && title.length > 2 && slug && !movies.find((m) => m.slug === slug)) {
          movies.push({
            id: slug,
            title,
            slug,
            rating: '',
            runtime: '',
            posterUrl: img ? img.getAttribute('src') || '' : '',
          });
        }
      });
      return movies;
    });
  });
}

async function getShowtimes(theatreSlug, movieSlug, date) {
  return withPage(async (page) => {
    const path = theatreSlug.includes('/') ? theatreSlug : `new-york-city/${theatreSlug}`;
    await page.goto(`${BASE}/movie-theatres/${path}/showtimes`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 5000));

    // If a specific date is requested, click the date tab
    if (date) {
      await page.evaluate((dateStr) => {
        const btns = document.querySelectorAll('button, a');
        for (const b of btns) {
          if (b.textContent.includes(dateStr)) {
            b.click();
            break;
          }
        }
      }, date);
      await new Promise((r) => setTimeout(r, 3000));
    }

    return page.evaluate((targetMovie) => {
      const movieMap = {};

      // Walk each showtime link and find its parent movie
      document.querySelectorAll('a[href*="/showtimes/"]').forEach((a) => {
        const time = a.textContent.trim();
        const href = a.getAttribute('href') || '';
        const id = href.split('/').pop();
        if (!/\d{1,2}:\d{2}/.test(time)) return;

        // Walk up the DOM to find the containing movie section
        let el = a;
        let movieTitle = '';
        let movieId = '';
        for (let i = 0; i < 15 && el; i++) {
          el = el.parentElement;
          if (!el) break;
          const mLink = el.querySelector('a[href*="/movies/"]');
          if (mLink) {
            const img = mLink.querySelector('img');
            movieTitle = img ? (img.getAttribute('alt') || mLink.textContent.trim()) : mLink.textContent.trim();
            movieId = (mLink.getAttribute('href') || '').replace(/.*\/movies\//, '').replace(/\/.*/, '');
            break;
          }
        }
        if (!movieTitle) return;

        // Filter by movie if specified
        if (targetMovie && movieId !== targetMovie && !movieTitle.toLowerCase().includes(targetMovie.toLowerCase())) return;

        const key = movieId || movieTitle;
        if (!movieMap[key]) movieMap[key] = [];
        movieMap[key].push({
          id,
          performanceNumber: id,
          dateTime: '',
          displayTime: time,
          format: '',
          attributes: [],
          url: href,
          isSoldOut: a.classList.contains('sold-out') || a.closest('.sold-out') !== null,
          movieTitle,
          movieId,
        });
      });

      // Flatten all movies' showtimes
      return Object.values(movieMap).flat();
    }, movieSlug || '');
  });
}

async function getSeatLayout(theatreId, showtimeId) {
  return withPage(async (page) => {
    // Navigate to the seat page — the showtimeId here should be the AMC website showtime ID
    const url = `${BASE}/showtimes/${showtimeId}/seats`;
    console.log('Puppeteer loading seat map:', url);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    }).catch((e) => console.log('Seat page nav:', e.message));

    // Wait for the seat labels to render (React hydration)
    try {
      await page.waitForSelector('label input', { timeout: 20000 });
      console.log('Seat labels found');
    } catch {
      // Check if we're being blocked
      const pageState = await page.evaluate(() => {
        const text = document.body.innerText;
        if (text.includes('rate limited') || text.includes('been blocked'))
          return 'BLOCKED: ' + text.substring(0, 200);
        if (text.includes('off script') || text.includes('Error'))
          return 'ERROR: ' + text.substring(0, 200);
        return 'NO_SEATS: labels=' + document.querySelectorAll('label').length + ' body=' + text.substring(0, 150);
      });
      console.log('Seat page state:', pageState);
    }
    await new Promise((r) => setTimeout(r, 2000));

    const data = await page.evaluate(() => {
      const labels = document.querySelectorAll('label[class*="mx-1"]');
      const seats = [];

      labels.forEach((label, idx) => {
        const isAvailable =
          label.className.includes('cursor-pointer') &&
          !label.className.includes('cursor-not-allowed');

        // Try aria-label first: "AMC Club Rocker A22"
        const ariaLabel = label.getAttribute('aria-label') || '';
        let row, seatNum, type = 'Standard';

        const ariaMatch = ariaLabel.match(/^(.+?)\s+([A-Z]{1,2})(\d+)$/);
        if (ariaMatch) {
          type = ariaMatch[1];
          row = ariaMatch[2];
          seatNum = parseInt(ariaMatch[3], 10);
        } else {
          // Fallback: use input name which has the seat name like "A20"
          const input = label.querySelector('input');
          const inputName = input ? (input.name || input.id || '') : '';
          const inputMatch = inputName.match(/^([A-Z]{1,2})(\d+)$/);
          if (!inputMatch) return;
          row = inputMatch[1];
          seatNum = parseInt(inputMatch[2], 10);

          // Detect accessible seats by SVG complexity:
          // Regular seat = 2 paths, Companion = 3 paths, Wheelchair = 4 paths
          const svg = label.querySelector('svg');
          const pathCount = svg ? svg.querySelectorAll('path').length : 0;
          if (pathCount >= 4) type = 'Wheelchair';
          else if (pathCount === 3) type = 'Companion';
        }

        if (type.includes('Wheelchair')) type = 'Wheelchair';
        else if (type.includes('Companion')) type = 'Companion';

        seats.push({
          row,
          column: seatNum,
          seatName: `${row}${seatNum}`,
          available: isAvailable,
          shouldDisplay: true,
          type,
        });
      });

      return seats;
    });

    return { seats: data, auditorium: null };
  });
}

// Clean up on exit
process.on('exit', () => { if (browser) browser.close().catch(() => {}); });
process.on('SIGINT', () => { if (browser) browser.close().catch(() => {}); process.exit(); });

module.exports = { getTheatres, getMovies, getShowtimes, getSeatLayout };
