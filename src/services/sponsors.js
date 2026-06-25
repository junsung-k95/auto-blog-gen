'use strict';

const { db, uuid, now } = require('../db');

const STATUSES = ['proposed', 'accepted', 'writing', 'published', 'settled', 'rejected'];

function userFilter(userId) {
  return userId ? 'AND user_id = ?' : '';
}

function list(userId) {
  return db.prepare(
    `SELECT * FROM sponsors WHERE 1=1 ${userFilter(userId)} ORDER BY received_at DESC`
  ).all(...(userId ? [userId] : []));
}

function getOne(userId, id) {
  return db.prepare(
    `SELECT * FROM sponsors WHERE id = ? ${userFilter(userId)}`
  ).get(id, ...(userId ? [userId] : []));
}

function create(userId, data) {
  const { company, contactEmail, productName, budgetKrw, notes, receivedAt, dueAt } = data;
  if (!company) throw new Error('company 필수');
  const id = uuid();
  const ts = now();
  db.prepare(`
    INSERT INTO sponsors (id, user_id, company, contact_email, product_name,
      budget_krw, status, notes, received_at, due_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'proposed', ?, ?, ?, ?, ?)
  `).run(id, userId || null, company, contactEmail || null, productName || null,
     budgetKrw || null, notes || null, receivedAt || ts.slice(0, 10), dueAt || null, ts, ts);
  return db.prepare('SELECT * FROM sponsors WHERE id = ?').get(id);
}

function update(userId, id, data) {
  const row = getOne(userId, id);
  if (!row) throw new Error('not found');

  const allowed = ['company', 'contact_email', 'product_name', 'budget_krw',
                   'status', 'notes', 'due_at', 'post_id'];
  const map = {
    company: data.company ?? row.company,
    contact_email: data.contactEmail ?? data.contact_email ?? row.contact_email,
    product_name: data.productName ?? data.product_name ?? row.product_name,
    budget_krw: data.budgetKrw ?? data.budget_krw ?? row.budget_krw,
    status: data.status ?? row.status,
    notes: data.notes ?? row.notes,
    due_at: data.dueAt ?? data.due_at ?? row.due_at,
    post_id: data.postId ?? data.post_id ?? row.post_id,
  };

  if (map.status && !STATUSES.includes(map.status)) throw new Error('잘못된 status');

  db.prepare(`
    UPDATE sponsors SET company=?, contact_email=?, product_name=?, budget_krw=?,
      status=?, notes=?, due_at=?, post_id=?, updated_at=? WHERE id=?
  `).run(map.company, map.contact_email, map.product_name, map.budget_krw,
     map.status, map.notes, map.due_at, map.post_id, now(), id);

  return db.prepare('SELECT * FROM sponsors WHERE id = ?').get(id);
}

function remove(userId, id) {
  const row = getOne(userId, id);
  if (!row) throw new Error('not found');
  db.prepare('DELETE FROM sponsors WHERE id = ?').run(id);
  return { ok: true };
}

function byStatus(userId) {
  const rows = list(userId);
  const out = {};
  STATUSES.forEach(s => { out[s] = []; });
  rows.forEach(r => {
    if (out[r.status]) out[r.status].push(r);
    else out['proposed'].push(r);
  });
  return out;
}

const DEMO = [
  { company: '코지인테리어', productName: '무소음 의자', budgetKrw: 150000, status: 'proposed', receivedAt: '2026-06-20', notes: '리뷰 원고 2000자 요청' },
  { company: '헬스케어플러스', productName: '단백질 쉐이크', budgetKrw: 200000, status: 'accepted', receivedAt: '2026-06-18', dueAt: '2026-06-30' },
  { company: '스마트가젯', productName: '미니 빔프로젝터', budgetKrw: 350000, status: 'writing', receivedAt: '2026-06-15', dueAt: '2026-06-28' },
  { company: '뷰티연구소', productName: '비타민C 세럼', budgetKrw: 120000, status: 'published', receivedAt: '2026-06-10' },
  { company: '로스터리카페', productName: '원두 구독 서비스', budgetKrw: 80000, status: 'settled', receivedAt: '2026-06-01' },
  { company: '에코스포츠', productName: '러닝화', budgetKrw: 180000, status: 'rejected', receivedAt: '2026-06-08', notes: '카테고리 미스매치' },
];

function seedDemo() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM sponsors').get();
  if (existing.c > 0) return { skipped: true };
  for (const d of DEMO) create(null, d);
  return { inserted: DEMO.length };
}

module.exports = { list, byStatus, create, update, remove, seedDemo, STATUSES };
