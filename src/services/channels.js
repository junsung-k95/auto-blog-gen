'use strict';

const { db, uuid, now } = require('../db');
const { encrypt, decrypt } = require('./crypto');

function maskedCreds(kind, raw) {
  if (!raw) return null;
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v) continue;
    const s = String(v);
    out[k] = s.length > 8 ? s.slice(0, 4) + '••••' + s.slice(-2) : '••••';
  }
  return out;
}

function row2channel(r, includeSecrets = false) {
  if (!r) return null;
  let creds = null;
  try { creds = r.credentials_enc ? JSON.parse(decrypt(r.credentials_enc)) : null; } catch {}
  return {
    id: r.id,
    kind: r.kind,
    active: !!r.active,
    createdAt: r.created_at,
    credentials: includeSecrets ? creds : maskedCreds(r.kind, creds),
  };
}

function listForUser(userId) {
  if (!userId) return [];
  return db.prepare('SELECT * FROM revenue_channels WHERE user_id = ? ORDER BY created_at')
    .all(userId).map(r => row2channel(r));
}

function upsertForUser(userId, kind, credentials) {
  if (!userId) throw new Error('로그인이 필요합니다.');
  if (!kind) throw new Error('채널 종류가 필요합니다.');
  const enc = credentials ? encrypt(JSON.stringify(credentials)) : null;
  const existing = db.prepare('SELECT id FROM revenue_channels WHERE user_id = ? AND kind = ?').get(userId, kind);
  if (existing) {
    db.prepare('UPDATE revenue_channels SET credentials_enc = ?, active = 1 WHERE id = ?')
      .run(enc, existing.id);
    return getById(userId, existing.id);
  }
  const id = uuid();
  db.prepare(`INSERT INTO revenue_channels (id, user_id, kind, credentials_enc, active, created_at)
    VALUES (?, ?, ?, ?, 1, ?)`).run(id, userId, kind, enc, now());
  return getById(userId, id);
}

function getById(userId, id) {
  const r = db.prepare('SELECT * FROM revenue_channels WHERE id = ? AND user_id = ?').get(id, userId);
  return row2channel(r);
}

function removeForUser(userId, id) {
  db.prepare('DELETE FROM revenue_channels WHERE id = ? AND user_id = ?').run(id, userId);
}

function getCredentialsForUser(userId, kind) {
  if (!userId) return null;
  const r = db.prepare('SELECT credentials_enc FROM revenue_channels WHERE user_id = ? AND kind = ? AND active = 1')
    .get(userId, kind);
  if (!r || !r.credentials_enc) return null;
  try { return JSON.parse(decrypt(r.credentials_enc)); } catch { return null; }
}

module.exports = { listForUser, upsertForUser, removeForUser, getCredentialsForUser };
