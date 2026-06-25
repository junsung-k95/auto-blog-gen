'use strict';

const { db, uuid, now } = require('../db');
const keywords = require('./keywords');
const posts = require('./posts');
const naver = require('./naver');
const metrics = require('./metrics');
const revenue = require('./revenue');

const HANDLERS = {};

function register(kind, handler) {
  HANDLERS[kind] = handler;
}

function enqueue(kind, payload = {}, runAt = new Date()) {
  const id = uuid();
  db.prepare(`INSERT INTO jobs (id, kind, run_at, status, payload, attempts, created_at, updated_at)
    VALUES (?, ?, ?, 'queued', ?, 0, ?, ?)`)
    .run(id, kind, runAt.toISOString(), JSON.stringify(payload), now(), now());
  return id;
}

async function runDue() {
  const due = db.prepare(
    `SELECT * FROM jobs WHERE status = 'queued' AND run_at <= ? ORDER BY run_at LIMIT 5`
  ).all(new Date().toISOString());

  for (const j of due) {
    db.prepare(`UPDATE jobs SET status = 'running', updated_at = ?, attempts = attempts + 1 WHERE id = ?`)
      .run(now(), j.id);
    const handler = HANDLERS[j.kind];
    if (!handler) {
      db.prepare(`UPDATE jobs SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?`)
        .run('handler not registered', now(), j.id);
      continue;
    }
    try {
      const payload = j.payload ? JSON.parse(j.payload) : {};
      await handler(payload);
      db.prepare(`UPDATE jobs SET status = 'done', updated_at = ? WHERE id = ?`).run(now(), j.id);
    } catch (err) {
      const maxAttempts = 3;
      const nextStatus = j.attempts >= maxAttempts ? 'failed' : 'queued';
      const nextRunAt = new Date(Date.now() + 60_000 * Math.pow(2, j.attempts)).toISOString();
      db.prepare(`UPDATE jobs SET status = ?, last_error = ?, run_at = ?, updated_at = ? WHERE id = ?`)
        .run(nextStatus, err.message.slice(0, 500), nextRunAt, now(), j.id);
      console.warn(`[job ${j.kind}] failed (attempt ${j.attempts}):`, err.message);
    }
  }
}

/** Cron-light: every minute check due jobs. */
function start() {
  // Register built-in handlers
  register('refresh_keywords', async ({ seeds }) => {
    const list = Array.isArray(seeds) && seeds.length ? seeds : ['캠핑', '디지털', '육아', '카페', '주방'];
    const result = await keywords.refreshFromSeeds(list);
    console.log('[refresh_keywords]', result);
  });

  register('publish_post', async ({ postId }) => {
    const post = posts.getForUser(null, postId);
    if (!post) throw new Error(`post ${postId} not found`);
    if (post.status === 'published') return; // idempotent
    posts.updateForUser(null, postId, { status: 'publishing' });
    try {
      const tags = Array.isArray(post.tags) ? post.tags : [];
      const naverPostId = await naver.publishPost(
        post.title, post.contentHtml, tags, post.category || '', true
      );
      posts.updateForUser(null, postId, {
        status: 'published',
        publishedAt: now(),
        naverPostId: String(naverPostId),
      });
      console.log(`[publish_post] published ${postId} → naver:${naverPostId}`);
    } catch (err) {
      posts.updateForUser(null, postId, { status: 'failed' });
      throw err;
    }
  });

  // M5: metrics scraping placeholder — wire real Naver stats scraper here
  register('scrape_metrics', async ({ postIds }) => {
    // Until a real scraper is implemented, just bump today's row with a
    // tiny random delta so the time series stays alive in demos.
    const list = Array.isArray(postIds) && postIds.length
      ? postIds
      : require('../db').db.prepare(
          `SELECT id FROM posts WHERE status = 'published'
           AND published_at >= datetime('now', '-7 days')`).all().map(r => r.id);
    const today = metrics.todayISO();
    for (const id of list) {
      const cur = require('../db').db.prepare(
        `SELECT visitors, views FROM post_metrics WHERE post_id = ? AND date = ?`
      ).get(id, today) || { visitors: 0, views: 0 };
      metrics.upsertDailyMetric(id, today, {
        visitors: cur.visitors + Math.round(Math.random() * 30),
        views:    cur.views    + Math.round(Math.random() * 50),
        avgDwellSec: 90, likes: 1, comments: 0, topRank: null,
      });
    }
    console.log(`[scrape_metrics] ${list.length} posts`);
  });

  register('sync_revenue', async ({ userId = null, date } = {}) => {
    const d = date || metrics.todayISO();
    const dailyAdpost = Math.round(3000 + Math.random() * 6000);
    const result = revenue.attributeAdPostDaily(userId, d, dailyAdpost);
    console.log(`[sync_revenue] adpost ${d}`, result);
  });

  register('rank_tracker', async () => {
    // Placeholder: real impl scrapes Naver search results for each
    // (post, primary keyword) pair and writes keyword_rank_history.
    console.log('[rank_tracker] noop (M5 placeholder)');
  });

  // Schedule the daily keyword refresh if not already queued for today
  scheduleDailyRefresh();
  scheduleHourly('scrape_metrics', { hour: null });
  scheduleDaily('sync_revenue', 4);
  scheduleDaily('rank_tracker', 6);

  setInterval(() => { runDue().catch(e => console.warn('[jobQueue]', e.message)); }, 60_000);
}

function scheduleDailyRefresh() {
  scheduleDaily('refresh_keywords', 3);
}

function scheduleDaily(kind, atHour) {
  const next = new Date();
  next.setHours(atHour, 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  const already = db.prepare(
    `SELECT id FROM jobs WHERE kind = ? AND status = 'queued' AND run_at = ?`
  ).get(kind, next.toISOString());
  if (!already) enqueue(kind, {}, next);
}

function scheduleHourly(kind) {
  const next = new Date();
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  const already = db.prepare(
    `SELECT id FROM jobs WHERE kind = ? AND status = 'queued' AND run_at = ?`
  ).get(kind, next.toISOString());
  if (!already) enqueue(kind, {}, next);
}

module.exports = { register, enqueue, runDue, start };
