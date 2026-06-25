'use strict';

const { db, uuid, now } = require('../db');
const { encrypt, decrypt } = require('./crypto');

function toJson(arr) { return arr ? JSON.stringify(arr) : null; }
function fromJson(s) { try { return s ? JSON.parse(s) : []; } catch { return []; } }

function row2profile(r, includeSecrets = false) {
  if (!r) return null;
  const base = {
    id: r.id,
    label: r.label,
    naverBlogId: r.naver_blog_id,
    categories: fromJson(r.categories),
    targetKeywords: fromJson(r.target_keywords),
    weeklyGoal: r.weekly_goal,
    goldenHours: fromJson(r.golden_hours),
    createdAt: r.created_at,
  };
  if (includeSecrets) {
    base.naverUsername = r.naver_username_enc ? decrypt(r.naver_username_enc) : null;
    base.naverApiPassword = r.naver_api_password_enc ? decrypt(r.naver_api_password_enc) : null;
  }
  return base;
}

function listForUser(userId) {
  if (!userId) return [];
  return db.prepare('SELECT * FROM blog_profiles WHERE user_id = ? ORDER BY created_at')
    .all(userId).map(r => row2profile(r));
}

function getForUser(userId, profileId, includeSecrets = false) {
  if (!userId) return null;
  const r = db.prepare('SELECT * FROM blog_profiles WHERE id = ? AND user_id = ?')
    .get(profileId, userId);
  return row2profile(r, includeSecrets);
}

function createForUser(userId, input) {
  if (!userId) throw new Error('로그인이 필요합니다.');
  if (!input?.label || !input?.naverBlogId) throw new Error('label, naverBlogId는 필수입니다.');
  const id = uuid();
  db.prepare(`INSERT INTO blog_profiles
    (id, user_id, label, naver_username_enc, naver_api_password_enc, naver_blog_id,
     categories, target_keywords, weekly_goal, golden_hours, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      id, userId, input.label,
      input.naverUsername ? encrypt(input.naverUsername) : null,
      input.naverApiPassword ? encrypt(input.naverApiPassword) : null,
      input.naverBlogId,
      toJson(input.categories || []),
      toJson(input.targetKeywords || []),
      input.weeklyGoal || 5,
      toJson(input.goldenHours || [7, 21]),
      now()
    );
  return getForUser(userId, id);
}

function updateForUser(userId, profileId, patch) {
  const existing = getForUser(userId, profileId, true);
  if (!existing) throw new Error('블로그 프로필을 찾을 수 없습니다.');
  const next = {
    label: patch.label ?? existing.label,
    naverUsername: patch.naverUsername ?? existing.naverUsername,
    naverApiPassword: patch.naverApiPassword ?? existing.naverApiPassword,
    naverBlogId: patch.naverBlogId ?? existing.naverBlogId,
    categories: patch.categories ?? existing.categories,
    targetKeywords: patch.targetKeywords ?? existing.targetKeywords,
    weeklyGoal: patch.weeklyGoal ?? existing.weeklyGoal,
    goldenHours: patch.goldenHours ?? existing.goldenHours,
  };
  db.prepare(`UPDATE blog_profiles SET
      label = ?, naver_username_enc = ?, naver_api_password_enc = ?, naver_blog_id = ?,
      categories = ?, target_keywords = ?, weekly_goal = ?, golden_hours = ?
    WHERE id = ? AND user_id = ?`)
    .run(
      next.label,
      next.naverUsername ? encrypt(next.naverUsername) : null,
      next.naverApiPassword ? encrypt(next.naverApiPassword) : null,
      next.naverBlogId,
      toJson(next.categories), toJson(next.targetKeywords),
      next.weeklyGoal, toJson(next.goldenHours),
      profileId, userId
    );
  return getForUser(userId, profileId);
}

function removeForUser(userId, profileId) {
  db.prepare('DELETE FROM blog_profiles WHERE id = ? AND user_id = ?').run(profileId, userId);
}

/**
 * Legacy resolver: when no auth/profile exists, fall back to ENV vars.
 * Used by /api/publish so the existing flow keeps working until users create profiles.
 */
function resolveCredentials(userId, profileId) {
  if (userId && profileId) {
    const p = getForUser(userId, profileId, true);
    if (p) return { username: p.naverUsername, apiPassword: p.naverApiPassword, blogId: p.naverBlogId };
  }
  return {
    username: process.env.NAVER_USERNAME,
    apiPassword: process.env.NAVER_API_PASSWORD,
    blogId: process.env.NAVER_BLOG_ID,
  };
}

module.exports = {
  listForUser, getForUser, createForUser, updateForUser, removeForUser, resolveCredentials,
};
