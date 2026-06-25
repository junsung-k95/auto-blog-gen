'use strict';

const { db, now } = require('../db');

function list(userId, limit = 30) {
  return db.prepare(
    `SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ?
     ORDER BY created_at DESC LIMIT ?`
  ).all(userId || null, limit);
}

function unreadCount(userId) {
  const r = db.prepare(
    `SELECT COUNT(*) as c FROM notifications
     WHERE (user_id IS NULL OR user_id = ?) AND read_at IS NULL`
  ).get(userId || null);
  return r ? r.c : 0;
}

function markRead(userId, id) {
  db.prepare(
    `UPDATE notifications SET read_at = ? WHERE id = ? AND (user_id IS NULL OR user_id = ?)`
  ).run(now(), id, userId || null);
  return { ok: true };
}

function markAllRead(userId) {
  db.prepare(
    `UPDATE notifications SET read_at = ? WHERE read_at IS NULL AND (user_id IS NULL OR user_id = ?)`
  ).run(now(), userId || null);
  return { ok: true };
}

function create(userId, type, title, body = null, link = null) {
  db.prepare(
    `INSERT INTO notifications (user_id, type, title, body, link, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId || null, type, title, body, link, now());
}

const DEMO_NOTIFS = [
  { type: 'publish_done', title: '발행 완료', body: '"캠핑 텐트 추천 TOP5" 글이 네이버 블로그에 발행됐습니다.', link: '#/inbox' },
  { type: 'slump_alert', title: '부진 글 감지', body: '"가성비 노트북 추천" — 14일간 노출 43. 리라이팅이 필요합니다.', link: '#/performance' },
  { type: 'keyword_refresh', title: '키워드 업데이트', body: '오늘 황금 키워드 15개가 새로 발굴됐습니다.', link: '#/discovery' },
  { type: 'sponsor_due', title: '협찬 마감 D-2', body: '스마트가젯 미니 빔프로젝터 원고 마감이 이틀 남았습니다.', link: '#/sponsors' },
];

function seedDemo() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM notifications').get();
  if (existing.c > 0) return { skipped: true };
  for (const n of DEMO_NOTIFS) create(null, n.type, n.title, n.body, n.link);
  return { inserted: DEMO_NOTIFS.length };
}

module.exports = { list, unreadCount, markRead, markAllRead, create, seedDemo };
