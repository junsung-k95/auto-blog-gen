'use strict';

const { db, uuid, now } = require('../db');
const keywords = require('./keywords');

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

  // Schedule the daily keyword refresh if not already queued for today
  scheduleDailyRefresh();

  setInterval(() => { runDue().catch(e => console.warn('[jobQueue]', e.message)); }, 60_000);
}

function scheduleDailyRefresh() {
  const next = new Date();
  next.setHours(3, 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);

  const already = db.prepare(
    `SELECT id FROM jobs WHERE kind = 'refresh_keywords' AND status = 'queued' AND run_at = ?`
  ).get(next.toISOString());
  if (!already) enqueue('refresh_keywords', {}, next);
}

module.exports = { register, enqueue, runDue, start };
