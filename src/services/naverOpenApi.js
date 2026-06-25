'use strict';

/**
 * Naver OpenAPI client wrappers (search + DataLab).
 * - All calls are server-side. NEVER expose CLIENT_ID/SECRET to browser.
 * - Returns null/empty for non-fatal failures so callers can degrade gracefully.
 */

function getCreds() {
  return {
    id: process.env.NAVER_CLIENT_ID,
    secret: process.env.NAVER_CLIENT_SECRET,
  };
}

function hasCreds() {
  const { id, secret } = getCreds();
  return !!(id && secret);
}

async function naverGet(path) {
  const { id, secret } = getCreds();
  if (!id || !secret) throw new Error('NAVER_CLIENT_ID/SECRET 미설정');
  const res = await fetch(`https://openapi.naver.com${path}`, {
    headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret },
  });
  if (!res.ok) throw new Error(`Naver ${res.status}`);
  return res.json();
}

async function naverPost(path, body) {
  const { id, secret } = getCreds();
  if (!id || !secret) throw new Error('NAVER_CLIENT_ID/SECRET 미설정');
  const res = await fetch(`https://openapi.naver.com${path}`, {
    method: 'POST',
    headers: {
      'X-Naver-Client-Id': id,
      'X-Naver-Client-Secret': secret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Naver DataLab ${res.status}`);
  return res.json();
}

/** Blog search hit count for a keyword. */
async function blogSearchCount(keyword) {
  try {
    const r = await naverGet(`/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=1`);
    return r.total ?? 0;
  } catch { return null; }
}

/** Cafe-article search hit count for a keyword. */
async function cafeSearchCount(keyword) {
  try {
    const r = await naverGet(`/v1/search/cafearticle.json?query=${encodeURIComponent(keyword)}&display=1`);
    return r.total ?? 0;
  } catch { return null; }
}

/**
 * DataLab keyword trend, weekly, 12 weeks back.
 * Returns { ratios:[…12], growth_4w }.
 */
async function dataLabTrend(keyword) {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 84); // ~12 weeks
    const fmt = d => d.toISOString().slice(0, 10);
    const r = await naverPost('/v1/datalab/search', {
      startDate: fmt(start),
      endDate: fmt(end),
      timeUnit: 'week',
      keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
    });
    const ratios = (r?.results?.[0]?.data || []).map(p => p.ratio);
    let growth4w = null;
    if (ratios.length >= 8) {
      const last4 = ratios.slice(-4).reduce((a, b) => a + b, 0);
      const prev4 = ratios.slice(-8, -4).reduce((a, b) => a + b, 0);
      if (prev4 > 0) growth4w = +(last4 / prev4).toFixed(3);
    }
    return { ratios, growth_4w: growth4w };
  } catch { return { ratios: [], growth_4w: null }; }
}

/**
 * Autocomplete-style suggestions from Naver search front (no official API).
 * Returns string[] of related keywords. Failures yield [].
 */
async function autocomplete(seed) {
  try {
    const url = `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(seed)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100&_callback=`;
    const res = await fetch(url, { headers: { 'Referer': 'https://www.naver.com/' } });
    if (!res.ok) return [];
    const text = await res.text();
    const data = JSON.parse(text);
    const items = data?.items?.[0] || [];
    return items.map(i => Array.isArray(i) ? i[0] : i).filter(Boolean).slice(0, 10);
  } catch { return []; }
}

module.exports = {
  hasCreds, blogSearchCount, cafeSearchCount, dataLabTrend, autocomplete,
};
