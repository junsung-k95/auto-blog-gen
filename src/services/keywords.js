'use strict';

const { db, uuid, now } = require('../db');
const naver = require('./naverOpenApi');

// Score weights (matches docs/03-requirements.md §3.5.1)
const W = { search: 0.30, comp: 0.25, growth: 0.20, cpc: 0.15, coupang: 0.07, category: 0.03 };

function todayISO() { return new Date().toISOString().slice(0, 10); }

function upsertKeyword(term, category = null) {
  const existing = db.prepare('SELECT * FROM keywords WHERE term = ?').get(term);
  if (existing) return existing;
  const id = uuid();
  db.prepare('INSERT INTO keywords (id, term, category, first_seen_at) VALUES (?, ?, ?, ?)')
    .run(id, term, category, now());
  return { id, term, category, first_seen_at: now() };
}

/** Saturate to 0..1 with log scaling so big numbers don't dominate. */
function logNorm(x, ref) {
  if (x == null || x <= 0) return 0;
  return Math.min(1, Math.log10(x + 1) / Math.log10(ref + 1));
}

/**
 * Compute golden score given the raw signals.
 * monthly_search: search volume proxy (here we use blog_volume + cafe_volume as a stand-in)
 * competition_ratio: blog_volume / monthly_search (smaller = better, so we invert)
 * trend_growth_4w: last4w/prev4w ratio (>1 means rising)
 * est_cpc: KRW
 * coupang_match: count
 * categoryMatch: 0|1
 */
function computeScore(s, categoryMatch = 0) {
  const search = logNorm(s.monthly_search ?? (s.blog_volume + s.cafe_volume) / 2, 1_000_000);
  const compInv = s.competition_ratio == null ? 0.5 : Math.max(0, 1 - Math.min(1, s.competition_ratio * 5));
  const growth  = s.trend_growth_4w == null ? 0.5 : Math.max(0, Math.min(1, (s.trend_growth_4w - 0.7) / 1.0));
  const cpc     = logNorm(s.est_cpc, 2000);
  const coupang = s.coupang_match_count ? Math.min(1, s.coupang_match_count / 30) : 0;
  const score = (
    W.search   * search +
    W.comp     * compInv +
    W.growth   * growth +
    W.cpc      * cpc +
    W.coupang  * coupang +
    W.category * categoryMatch
  ) * 100;
  return +score.toFixed(1);
}

/**
 * Collect snapshot signals for a single keyword.
 * Doesn't write to DB — caller does.
 */
async function collectSignals(term) {
  const [blog, cafe, trend] = await Promise.all([
    naver.blogSearchCount(term),
    naver.cafeSearchCount(term),
    naver.dataLabTrend(term),
  ]);
  const monthly = (blog ?? 0) / 30; // rough proxy
  const comp = blog && monthly > 0 ? blog / Math.max(monthly, 1) : null;
  // CPC estimation placeholder: real numbers come from search-ads/keyword tool later
  const estCpc = blog ? Math.round(150 + (Math.log10(blog + 1) * 100)) : 300;
  return {
    blog_volume: blog,
    cafe_volume: cafe,
    monthly_search: Math.round(monthly),
    competition_ratio: comp,
    trend_4w: trend.ratios.slice(-4),
    trend_growth_4w: trend.growth_4w,
    est_cpc: estCpc,
    coupang_match_count: 0, // wired in M3
  };
}

function writeSnapshot(keywordId, signals, score) {
  db.prepare(`INSERT OR REPLACE INTO keyword_snapshots
    (keyword_id, captured_at, blog_volume, cafe_volume, monthly_search,
     competition_ratio, trend_4w, trend_growth_4w, est_cpc, coupang_match_count, score_total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      keywordId, todayISO(),
      signals.blog_volume, signals.cafe_volume, signals.monthly_search,
      signals.competition_ratio,
      JSON.stringify(signals.trend_4w),
      signals.trend_growth_4w, signals.est_cpc, signals.coupang_match_count,
      score
    );
}

/**
 * Expand a category seed into candidate keywords using autocomplete + curated suffixes.
 * Returns a deduplicated array of terms (max ~15).
 */
async function expandSeed(seed) {
  const suffixes = ['추천', '후기', '가격', '베스트', '순위', '비교', '리뷰', '인기'];
  const candidates = new Set([seed]);
  const ac = await naver.autocomplete(seed);
  ac.forEach(t => candidates.add(t));
  suffixes.forEach(s => candidates.add(`${seed} ${s}`));
  return [...candidates].slice(0, 15);
}

/**
 * Run a refresh cycle for the given seeds (typically the user's categories).
 * Upserts keywords + writes today's snapshot. Skips Naver calls if no creds.
 */
async function refreshFromSeeds(seeds = []) {
  if (!naver.hasCreds() || seeds.length === 0) return { upserted: 0, snapshots: 0 };
  let upserted = 0, snapshots = 0;
  for (const seed of seeds) {
    const terms = await expandSeed(seed);
    for (const term of terms) {
      const kw = upsertKeyword(term, seed);
      upserted++;
      try {
        const sig = await collectSignals(term);
        const score = computeScore(sig, /* category match */ 1);
        writeSnapshot(kw.id, sig, score);
        snapshots++;
      } catch (e) {
        console.warn(`[keywords] snapshot failed for "${term}":`, e.message);
      }
    }
  }
  return { upserted, snapshots };
}

/** Latest snapshot per keyword, joined with keyword info, optionally filtered. */
function recommend({ category = null, limit = 24, userId = null } = {}) {
  const rows = db.prepare(`
    SELECT k.id, k.term, k.category,
           s.blog_volume, s.cafe_volume, s.monthly_search,
           s.competition_ratio, s.trend_4w, s.trend_growth_4w,
           s.est_cpc, s.coupang_match_count, s.score_total, s.captured_at,
           (SELECT state FROM keyword_bookmarks b WHERE b.keyword_id = k.id AND b.user_id = ?) AS bookmark_state
    FROM keywords k
    JOIN keyword_snapshots s ON s.keyword_id = k.id
    WHERE s.captured_at = (SELECT MAX(captured_at) FROM keyword_snapshots WHERE keyword_id = k.id)
      ${category ? 'AND k.category = ?' : ''}
      AND (bookmark_state IS NULL OR bookmark_state <> 'ignored')
    ORDER BY s.score_total DESC
    LIMIT ?
  `).all(userId || '', ...(category ? [category] : []), limit);

  return rows.map(r => ({
    id: r.id,
    term: r.term,
    category: r.category,
    score: r.score_total,
    capturedAt: r.captured_at,
    bookmarkState: r.bookmark_state,
    signals: {
      blogVolume: r.blog_volume,
      cafeVolume: r.cafe_volume,
      monthlySearch: r.monthly_search,
      competitionRatio: r.competition_ratio,
      trend4w: r.trend_4w ? JSON.parse(r.trend_4w) : [],
      trendGrowth4w: r.trend_growth_4w,
      estCpc: r.est_cpc,
      coupangMatches: r.coupang_match_count,
    },
  }));
}

function getById(id, userId = null) {
  const r = db.prepare(`
    SELECT k.id, k.term, k.category, k.first_seen_at,
           s.blog_volume, s.cafe_volume, s.monthly_search,
           s.competition_ratio, s.trend_4w, s.trend_growth_4w,
           s.est_cpc, s.coupang_match_count, s.score_total, s.captured_at,
           (SELECT state FROM keyword_bookmarks b WHERE b.keyword_id = k.id AND b.user_id = ?) AS bookmark_state
    FROM keywords k
    LEFT JOIN keyword_snapshots s ON s.keyword_id = k.id
    WHERE k.id = ?
    ORDER BY s.captured_at DESC
    LIMIT 1
  `).get(userId || '', id);
  if (!r) return null;
  const history = db.prepare(`
    SELECT captured_at, score_total, blog_volume, monthly_search
    FROM keyword_snapshots WHERE keyword_id = ?
    ORDER BY captured_at DESC LIMIT 30
  `).all(id);
  return {
    id: r.id, term: r.term, category: r.category, firstSeenAt: r.first_seen_at,
    score: r.score_total, capturedAt: r.captured_at, bookmarkState: r.bookmark_state,
    signals: {
      blogVolume: r.blog_volume, cafeVolume: r.cafe_volume,
      monthlySearch: r.monthly_search,
      competitionRatio: r.competition_ratio,
      trend4w: r.trend_4w ? JSON.parse(r.trend_4w) : [],
      trendGrowth4w: r.trend_growth_4w,
      estCpc: r.est_cpc, coupangMatches: r.coupang_match_count,
    },
    history,
  };
}

function bookmark(userId, keywordId, state /* 'saved' | 'ignored' | null */) {
  if (!userId || !keywordId) throw new Error('userId, keywordId 필요');
  if (state == null) {
    db.prepare('DELETE FROM keyword_bookmarks WHERE user_id = ? AND keyword_id = ?').run(userId, keywordId);
    return { state: null };
  }
  db.prepare(`INSERT INTO keyword_bookmarks (user_id, keyword_id, state, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, keyword_id) DO UPDATE SET state = excluded.state`)
    .run(userId, keywordId, state, now());
  return { state };
}

/** Seed demo snapshots so the UI is useful even without Naver creds. */
function seedDemo() {
  const demo = [
    { term: '캠핑 의자',     category: '캠핑', score: 92, blog: 1830000, monthly: 18000, cpc: 320, comp: 0.4, growth: 1.24, coupang: 14 },
    { term: '갤럭시 S26',     category: '디지털', score: 78, blog: 8200000, monthly: 240000, cpc: 580, comp: 1.1, growth: 1.42, coupang: 22 },
    { term: '어린이날 선물',  category: '육아', score: 85, blog: 3100000, monthly: 95000, cpc: 410, comp: 0.6, growth: 1.31, coupang: 31 },
    { term: '성수동 카페',    category: '카페', score: 81, blog: 4200000, monthly: 28000, cpc: 290, comp: 0.5, growth: 1.08, coupang: 0 },
    { term: '에어프라이어 추천', category: '주방', score: 88, blog: 2400000, monthly: 41000, cpc: 470, comp: 0.45, growth: 1.18, coupang: 26 },
    { term: '키보드 무선', category: '디지털', score: 73, blog: 1700000, monthly: 22000, cpc: 380, comp: 0.55, growth: 0.95, coupang: 18 },
  ];
  const date = todayISO();
  const tx = db.transaction(() => {
    for (const d of demo) {
      const k = upsertKeyword(d.term, d.category);
      db.prepare(`INSERT OR REPLACE INTO keyword_snapshots
        (keyword_id, captured_at, blog_volume, cafe_volume, monthly_search,
         competition_ratio, trend_4w, trend_growth_4w, est_cpc, coupang_match_count, score_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(
          k.id, date, d.blog, Math.round(d.blog / 5), d.monthly,
          d.comp, JSON.stringify([85, 88, 92, 94]), d.growth, d.cpc, d.coupang, d.score
        );
    }
  });
  tx();
}

module.exports = {
  upsertKeyword, computeScore, refreshFromSeeds, expandSeed,
  recommend, getById, bookmark, seedDemo,
};
