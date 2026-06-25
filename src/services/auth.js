'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, uuid, now } = require('../db');

const SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-replace-in-prod';
const JWT_EXPIRY = '7d';

async function signup(email, password) {
  if (!email || !password) throw new Error('이메일과 비밀번호는 필수입니다.');
  if (password.length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다.');
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) throw new Error('이미 가입된 이메일입니다.');
  const hash = await bcrypt.hash(password, 10);
  const id = uuid();
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(id, email, hash, now());
  return { id, email, token: issueToken({ id, email }) };
}

async function login(email, password) {
  const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email);
  if (!user) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
  return { id: user.id, email: user.email, token: issueToken({ id: user.id, email: user.email }) };
}

function issueToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token) {
  try { return jwt.verify(token, SECRET); }
  catch { return null; }
}

/**
 * Express middleware. Reads Authorization: Bearer <jwt>.
 * On success: req.user = { id, email }.
 * Soft mode: if AUTH_REQUIRED !== 'true', missing token is allowed (legacy single-user mode).
 */
function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || '';
  const m = hdr.match(/^Bearer (.+)$/);
  const token = m ? m[1] : null;
  const decoded = token ? verifyToken(token) : null;
  if (decoded) {
    req.user = { id: decoded.id, email: decoded.email };
    return next();
  }
  if (process.env.AUTH_REQUIRED === 'true') {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  // Soft mode: legacy single-user env-based deployment keeps working
  req.user = null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  next();
}

module.exports = { signup, login, verifyToken, authMiddleware, requireAuth };
