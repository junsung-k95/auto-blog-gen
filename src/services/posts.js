'use strict';

const { db, uuid, now } = require('../db');

function toJson(v) { return v == null ? null : JSON.stringify(v); }
function fromJson(s) { try { return s ? JSON.parse(s) : []; } catch { return []; } }

function row2post(r) {
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    blogProfileId: r.blog_profile_id,
    status: r.status,
    title: r.title,
    contentHtml: r.content_html,
    tags: fromJson(r.tags),
    category: r.category,
    scheduledAt: r.scheduled_at,
    publishedAt: r.published_at,
    naverPostId: r.naver_post_id,
    aiProvider: r.ai_provider,
    tokenCostUsd: r.token_cost_usd,
    seoScore: r.seo_score,
    riskFlags: fromJson(r.risk_flags),
    disclosureKind: r.disclosure_kind,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function preview(html, n = 140) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > n ? text.slice(0, n) + '…' : text;
}

/** Userless scope (soft-mode): treats NULL user_id as "shared" so legacy single-user setups still work. */
function userFilter(userId) {
  return userId
    ? { clause: '(user_id = ? OR user_id IS NULL)', args: [userId] }
    : { clause: '(user_id IS NULL)', args: [] };
}

function listForUser(userId, { status, from, to, limit = 100 } = {}) {
  const f = userFilter(userId);
  let sql = `SELECT * FROM posts WHERE ${f.clause}`;
  const args = [...f.args];
  if (status) { sql += ' AND status = ?'; args.push(status); }
  if (from)   { sql += ' AND (scheduled_at >= ? OR published_at >= ?)'; args.push(from, from); }
  if (to)     { sql += ' AND (scheduled_at < ?  OR published_at < ?)';  args.push(to, to); }
  sql += ' ORDER BY COALESCE(scheduled_at, published_at, updated_at) DESC LIMIT ?';
  args.push(Math.min(limit, 500));
  return db.prepare(sql).all(...args).map(r => {
    const p = row2post(r);
    p.preview = preview(p.contentHtml);
    return p;
  });
}

function getForUser(userId, id) {
  const f = userFilter(userId);
  const r = db.prepare(`SELECT * FROM posts WHERE id = ? AND ${f.clause}`).get(id, ...f.args);
  return row2post(r);
}

function createForUser(userId, input) {
  const id = uuid();
  const ts = now();
  db.prepare(`INSERT INTO posts (
      id, user_id, blog_profile_id, status, title, content_html, tags, category,
      scheduled_at, ai_provider, token_cost_usd, seo_score, risk_flags, disclosure_kind,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      id, userId || null, input.blogProfileId || null,
      input.status || 'draft',
      input.title || '', input.contentHtml || '',
      toJson(input.tags || []), input.category || null,
      input.scheduledAt || null,
      input.aiProvider || null, input.tokenCostUsd || null,
      input.seoScore || null, toJson(input.riskFlags || []),
      input.disclosureKind || 'none',
      ts, ts
    );
  return getForUser(userId, id);
}

function updateForUser(userId, id, patch) {
  const existing = getForUser(userId, id);
  if (!existing) throw new Error('포스트를 찾을 수 없습니다.');
  const merged = { ...existing, ...patch };
  db.prepare(`UPDATE posts SET
      status = ?, title = ?, content_html = ?, tags = ?, category = ?,
      scheduled_at = ?, published_at = ?, naver_post_id = ?,
      ai_provider = ?, token_cost_usd = ?, seo_score = ?, risk_flags = ?, disclosure_kind = ?,
      updated_at = ?
    WHERE id = ?`)
    .run(
      merged.status, merged.title, merged.contentHtml,
      toJson(merged.tags || []), merged.category || null,
      merged.scheduledAt || null, merged.publishedAt || null, merged.naverPostId || null,
      merged.aiProvider || null, merged.tokenCostUsd || null,
      merged.seoScore || null, toJson(merged.riskFlags || []),
      merged.disclosureKind || 'none',
      now(),
      id
    );
  return getForUser(userId, id);
}

function removeForUser(userId, id) {
  const f = userFilter(userId);
  db.prepare(`DELETE FROM posts WHERE id = ? AND ${f.clause}`).run(id, ...f.args);
}

function countsByStatus(userId) {
  const f = userFilter(userId);
  const rows = db.prepare(`SELECT status, COUNT(*) AS n FROM posts WHERE ${f.clause} GROUP BY status`)
    .all(...f.args);
  const result = { draft: 0, review: 0, scheduled: 0, publishing: 0, published: 0, failed: 0 };
  rows.forEach(r => { result[r.status] = r.n; });
  return result;
}

/** Find scheduled posts whose run_at has arrived. */
function findDueScheduled(asOf = new Date()) {
  return db.prepare(`SELECT * FROM posts WHERE status = 'scheduled' AND scheduled_at <= ?`)
    .all(asOf.toISOString())
    .map(row2post);
}

module.exports = {
  listForUser, getForUser, createForUser, updateForUser, removeForUser,
  countsByStatus, findDueScheduled,
};
