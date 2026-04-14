const { fetch } = require('undici');
const config = require('../config');

const API_BASE = 'https://api.amctheatres.com';

async function apiGet(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'X-AMC-Vendor-Key': config.amcApiKey,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AMC API ${res.status}: ${endpoint} - ${body.substring(0, 200)}`);
  }
  return res.json();
}

async function getTheatres(query) {
  // The API supports name and market search
  const isZip = /^\d{5}$/.test(query.trim());
  let endpoint;
  if (isZip) {
    // For zip codes, use location-based search via showtimes endpoint,
    // or use name search with the zip (AMC doesn't have a zip search on theatres)
    // Fallback: just get all and filter, or use market
    endpoint = `/v2/theatres?name=${encodeURIComponent(query)}&page-size=20`;
  } else {
    endpoint = `/v2/theatres?name=${encodeURIComponent(query)}&page-size=20`;
  }

  const data = await apiGet(endpoint);
  const theatres = data._embedded?.theatres || [];
  return theatres.map((t) => ({
    id: String(t.id),
    name: t.longName || t.name,
    slug: t.slug || '',
    market: t.market || '',
    address: t.location?.addressLine1 || t.address1 || '',
    city: t.location?.city || t.city || '',
    state: t.location?.state || t.state || '',
    zipCode: t.location?.postalCode || t.postalCode || '',
  }));
}

async function getMovies(theatreId) {
  // Get all future showtimes for theatre, then extract unique movies
  const data = await apiGet(
    `/v2/theatres/${theatreId}/showtimes?page-size=100`
  );
  const showtimes = data._embedded?.showtimes || [];

  // Extract unique movies from showtimes
  const movieMap = new Map();
  for (const s of showtimes) {
    if (s.movieId && !movieMap.has(s.movieId)) {
      movieMap.set(s.movieId, {
        id: String(s.movieId),
        title: s.movieName || s.movie || '',
        slug: '',
        rating: s.mpaaRating || '',
        runtime: '',
        posterUrl: '',
      });
    }
  }

  return Array.from(movieMap.values());
}

async function getShowtimes(theatreId, movieId, date) {
  let endpoint;
  if (date) {
    // Date format expected: YYYY-MM-DD
    const dateStr = date.replace(/-/g, '-');
    endpoint = `/v2/theatres/${theatreId}/showtimes/${dateStr}?page-size=100`;
  } else {
    endpoint = `/v2/theatres/${theatreId}/showtimes?page-size=100`;
  }

  if (movieId) {
    endpoint += `${endpoint.includes('?') ? '&' : '?'}movie-id=${movieId}`;
  }

  const data = await apiGet(endpoint);
  const showtimes = data._embedded?.showtimes || [];

  return showtimes.map((s) => {
    const attrs = (s.attributes || []).map((a) => a.name || a.code);

    // Build a concise display format from premiumFormat + notable attributes
    // e.g. "IMAX 70MM", "70mm", "Laser at AMC", "Dolby Cinema at AMC"
    const isIMAX = attrs.some((a) => a.includes('IMAX'));
    const is70mm = attrs.some((a) => a.includes('70mm')) || (s.premiumFormat || '').includes('70mm');
    const isDolby = (s.premiumFormat || '').includes('Dolby') || attrs.some((a) => a.includes('Dolby'));
    const isLaser = attrs.some((a) => a === 'Laser at AMC');
    const isPRIME = (s.premiumFormat || '').includes('PRIME') || attrs.some((a) => a.includes('PRIME'));
    const is3D = attrs.some((a) => a.includes('RealD 3D') || a.includes('3D'));

    let format = '';
    if (isIMAX && is70mm) format = 'IMAX 70mm';
    else if (isIMAX) format = 'IMAX';
    else if (isDolby) format = 'Dolby Cinema';
    else if (isPRIME) format = 'PRIME';
    else if (is70mm) format = '70mm';
    else if (isLaser) format = 'Laser';
    if (is3D && !format.includes('3D')) format = format ? format + ' 3D' : 'RealD 3D';

    return {
      id: String(s.id),
      performanceNumber: String(s.performanceNumber),
      dateTime: s.showDateTimeUtc || s.showDateTimeLocal || '',
      displayTime: s.showDateTimeLocal || s.showDateTimeUtc || '',
      format,
      attributes: attrs,
      url: `/showtimes/${s.id}`,
      isSoldOut: s.isSoldOut || false,
      movieTitle: s.movieName || '',
      movieId: String(s.movieId || ''),
      theatreId: String(s.theatreId || theatreId),
    };
  });
}

async function getSeatLayout(theatreId, performanceNumber) {
  const data = await apiGet(
    `/v2/seating-layouts/${theatreId}/${performanceNumber}`
  );

  const seats = (data.seats || []).map((s) => ({
    row: s.row,
    column: s.column,
    seatName: s.seatName,
    available: s.type === 'CanReserve',
    shouldDisplay: s.type !== 'NotASeat',
    type: s.type,
    seatTier: s.seatTier || '',
  }));

  return {
    seats,
    auditorium: {
      theatreNumber: data.theatreNumber,
      performanceNumber: data.performanceNumber,
      rows: data.rows,
      columns: data.columns,
    },
  };
}

module.exports = { getTheatres, getMovies, getShowtimes, getSeatLayout };
