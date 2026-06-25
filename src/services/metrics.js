'use strict';

const { db } = require('../db');

function todayISO() { return new Date().toISOString().slice(0, 10); }

/**
 * Upsert daily metrics for a post.
 * payload: { visitors, views, avgDwellSec, inboundKeywords?, likes?, comments?, topRank? }
 */
function upsertDailyMetric(postId, date, payload) {
  db.prepare(`INSERT INTO post_metrics
    (post_id, date, visitors, views, avg_dwell_sec, inbound_keywords, likes, comments, top_rank)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(post_id, date) DO UPDATE SET
      visitors = excluded.visitors,
      views = excluded.views,
      avg_dwell_sec = excluded.avg_dwell_sec,
      inbound_keywords = excluded.inbound_keywords,
      likes = excluded.likes,
      comments = excluded.comments,
      top_rank = excluded.top_rank`)
    .run(
      postId, date,
      payload.visitors || 0,
      payload.views || 0,
      payload.avgDwellSec || 0,
      payload.inboundKeywords ? JSON.stringify(payload.inboundKeywords) : null,
      payload.likes || 0,
      payload.comments || 0,
      payload.topRank || null,
    );
}

/** Time-series for one post over the last N days. */
function getSeries(postId, days = 30) {
  return db.prepare(`SELECT date, visitors, views, avg_dwell_sec, likes, comments, top_rank, inbound_keywords
    FROM post_metrics WHERE post_id = ?
    ORDER BY date DESC LIMIT ?`)
    .all(postId, days)
    .map(r => ({
      date: r.date,
      visitors: r.visitors,
      views: r.views,
      avgDwellSec: r.avg_dwell_sec,
      likes: r.likes,
      comments: r.comments,
      topRank: r.top_rank,
      inboundKeywords: r.inbound_keywords ? JSON.parse(r.inbound_keywords) : [],
    }))
    .reverse();
}

/** Aggregate metrics for a user across a date window. */
function aggregateForUser(userId, days = 30) {
  const since = new Date(); since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);
  const userFilter = userId ? '(p.user_id = ? OR p.user_id IS NULL)' : '(p.user_id IS NULL)';
  const args = userId ? [userId, sinceIso] : [sinceIso];
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(m.visitors), 0) AS visitors,
      COALESCE(SUM(m.views), 0) AS views,
      COALESCE(SUM(m.likes), 0) AS likes,
      COALESCE(SUM(m.comments), 0) AS comments
    FROM post_metrics m JOIN posts p ON p.id = m.post_id
    WHERE ${userFilter} AND m.date >= ?
  `).get(...args);

  const daily = db.prepare(`
    SELECT m.date,
      COALESCE(SUM(m.visitors), 0) AS visitors,
      COALESCE(SUM(m.views), 0) AS views
    FROM post_metrics m JOIN posts p ON p.id = m.post_id
    WHERE ${userFilter} AND m.date >= ?
    GROUP BY m.date ORDER BY m.date
  `).all(...args);

  return { totals, daily };
}

/** Top-N posts by visitors over a window (for performance rankings). */
function topPostsByVisitors(userId, days = 30, limit = 10) {
  const since = new Date(); since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);
  const userFilter = userId ? '(p.user_id = ? OR p.user_id IS NULL)' : '(p.user_id IS NULL)';
  const args = userId ? [userId, sinceIso, limit] : [sinceIso, limit];
  return db.prepare(`
    SELECT p.id, p.title, p.status, p.published_at,
      COALESCE(SUM(m.visitors), 0) AS visitors,
      COALESCE(SUM(m.views), 0) AS views,
      MIN(m.top_rank) AS best_rank
    FROM posts p LEFT JOIN post_metrics m ON m.post_id = p.id AND m.date >= ?
    WHERE ${userFilter} AND p.status = 'published'
    GROUP BY p.id ORDER BY visitors DESC LIMIT ?
  `).all(...args).map(r => ({
    id: r.id, title: r.title, status: r.status, publishedAt: r.published_at,
    visitors: r.visitors, views: r.views, bestRank: r.best_rank,
  }));
}

/** Posts published ≥ N days ago with low recent traffic — slump alerts. */
function slumpingPosts(userId, lookbackDays = 14, visitorThreshold = 100) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - lookbackDays);
  const cutoffIso = cutoff.toISOString();
  const userFilter = userId ? '(p.user_id = ? OR p.user_id IS NULL)' : '(p.user_id IS NULL)';
  const args = userId
    ? [userId, cutoffIso.slice(0, 10), cutoffIso, visitorThreshold]
    : [cutoffIso.slice(0, 10), cutoffIso, visitorThreshold];
  return db.prepare(`
    SELECT p.id, p.title, p.published_at,
      COALESCE(SUM(m.visitors), 0) AS visitors
    FROM posts p LEFT JOIN post_metrics m ON m.post_id = p.id AND m.date >= ?
    WHERE ${userFilter} AND p.status = 'published' AND p.published_at <= ?
    GROUP BY p.id HAVING visitors < ?
    ORDER BY visitors ASC LIMIT 20
  `).all(...args).map(r => ({
    id: r.id, title: r.title, publishedAt: r.published_at, visitors: r.visitors,
  }));
}

module.exports = {
  todayISO, upsertDailyMetric, getSeries,
  aggregateForUser, topPostsByVisitors, slumpingPosts,
};
