import dotenv from 'dotenv';

dotenv.config();

const BASE = process.env.GDELT_BASE_URL || 'https://api.gdeltproject.org/api/v2';
const MIN_INTERVAL_MS = Number(process.env.GDELT_MIN_INTERVAL_MS || 5500);

let lastCallTs = 0;
let inFlight = Promise.resolve();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttledCall(task) {
  inFlight = inFlight.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, MIN_INTERVAL_MS - (now - lastCallTs));
    if (waitMs > 0) await sleep(waitMs);
    const result = await task();
    lastCallTs = Date.now();
    return result;
  });
  return inFlight;
}

async function fetchJsonWithSafeParse(url) {
  const res = await fetch(url);
  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`GDELT HTTP ${res.status}: ${txt.slice(0, 180)}`);
  }
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error(`GDELT JSON parse failed: ${txt.slice(0, 180)}`);
  }
}

function normalizeArticle(a = {}) {
  return {
    title: a.title || '',
    url: a.url || '',
    seendate: a.seendate || '',
    socialimage: a.socialimage || '',
    sourcecountry: a.sourcecountry || '',
    sourcecommonname: a.sourcecommonname || '',
    domain: a.domain || '',
    language: a.language || ''
  };
}

function fallbackArticles(query) {
  const q = query || 'international relations';
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return [
    {
      title: `[Fallback] ${q} - Diplomatic developments overview`,
      url: 'https://ourworldindata.org',
      seendate: now,
      socialimage: '',
      sourcecountry: '',
      sourcecommonname: 'Fallback',
      domain: 'ourworldindata.org',
      language: 'en'
    },
    {
      title: `[Fallback] ${q} - Regional security update`,
      url: 'https://www.un.org',
      seendate: now,
      socialimage: '',
      sourcecountry: '',
      sourcecommonname: 'Fallback',
      domain: 'un.org',
      language: 'en'
    }
  ];
}

export async function getNews({ query = 'international relations', lang = 'en', maxRecords = 25 }) {
  const url =
    `${BASE}/doc/doc` +
    `?query=${encodeURIComponent(query)}` +
    `&mode=artlist` +
    `&maxrecords=${Math.min(Math.max(Number(maxRecords) || 25, 1), 100)}` +
    `&sourcelang=${encodeURIComponent(lang)}` +
    `&format=json`;

  try {
    const data = await throttledCall(() => fetchJsonWithSafeParse(url));
    return (data.articles || []).map(normalizeArticle);
  } catch {
    return fallbackArticles(query);
  }
}

export async function getEvents({ query = 'conflict', maxRecords = 50 }) {
  const url =
    `${BASE}/doc/doc` +
    `?query=${encodeURIComponent(query)}` +
    `&mode=artlist` +
    `&maxrecords=${Math.min(Math.max(Number(maxRecords) || 50, 1), 100)}` +
    `&format=json`;

  try {
    const data = await throttledCall(() => fetchJsonWithSafeParse(url));
    return (data.articles || []).map(normalizeArticle);
  } catch {
    return fallbackArticles(query);
  }
}

function toGdeltDateTime(dateLike, isEnd = false) {
  if (!dateLike) return '';
  const d = new Date(dateLike);
  if (!Number.isFinite(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = isEnd ? '23' : '00';
  const mm = isEnd ? '59' : '00';
  const ss = isEnd ? '59' : '00';
  return `${y}${m}${day}${hh}${mm}${ss}`;
}

export async function getEventsInRange({
  query = 'middle east diplomacy',
  lang = 'en',
  maxRecords = 50,
  startDate,
  endDate
}) {
  const startDateTime = toGdeltDateTime(startDate, false);
  const endDateTime = toGdeltDateTime(endDate, true);
  const url =
    `${BASE}/doc/doc` +
    `?query=${encodeURIComponent(query)}` +
    `&mode=artlist` +
    `&maxrecords=${Math.min(Math.max(Number(maxRecords) || 50, 1), 100)}` +
    (lang ? `&sourcelang=${encodeURIComponent(lang)}` : '') +
    (startDateTime ? `&startdatetime=${startDateTime}` : '') +
    (endDateTime ? `&enddatetime=${endDateTime}` : '') +
    `&format=json`;

  try {
    const data = await throttledCall(() => fetchJsonWithSafeParse(url));
    return (data.articles || []).map(normalizeArticle);
  } catch {
    return fallbackArticles(query);
  }
}

