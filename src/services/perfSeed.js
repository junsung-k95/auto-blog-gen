'use strict';

/**
 * Demo seed so /performance and /revenue have meaningful data
 * before real scraping/API integrations land. Idempotent: if any
 * post_metrics or revenue rows exist, this is a no-op.
 */

const { db, uuid, now } = require('../db');
const metrics = require('./metrics');
const revenue = require('./revenue');

function hasAnyData() {
  const m = db.prepare('SELECT COUNT(*) AS n FROM post_metrics').get().n;
  const r = db.prepare('SELECT COUNT(*) AS n FROM revenue_records').get().n;
  return m > 0 || r > 0;
}

function ensurePosts() {
  const cnt = db.prepare(`SELECT COUNT(*) AS n FROM posts WHERE status = 'published'`).get().n;
  if (cnt >= 3) return;

  const samples = [
    { title: '성수동 카페 추천 5선 — 감성과 커피 모두 잡은 곳', tags: ['성수동', '카페', '데이트', '서울맛집'] },
    { title: '갤럭시 워치 6 솔직 후기 — 한 달 써본 장단점',     tags: ['갤럭시워치', '스마트워치', '리뷰'] },
    { title: '다이슨 V15 디테일 리뷰 — 구매 전 꼭 봐야 할 점', tags: ['다이슨', '청소기', '리뷰'] },
    { title: '캠핑 의자 추천 BEST3 — 헬리녹스 vs 코베아 비교', tags: ['캠핑', '캠핑의자', '아웃도어'] },
  ];
  const tx = db.transaction(() => {
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const id = uuid();
      const publishedAt = new Date();
      publishedAt.setDate(publishedAt.getDate() - (5 + i * 4));
      db.prepare(`INSERT INTO posts (id, user_id, status, title, content_html, tags,
          published_at, ai_provider, seo_score, disclosure_kind, created_at, updated_at)
        VALUES (?, NULL, 'published', ?, ?, ?, ?, 'claude', ?, 'coupang_affiliate', ?, ?)`)
        .run(
          id, s.title, `<h2>${s.title}</h2><p>본문 ...</p>`,
          JSON.stringify(s.tags), publishedAt.toISOString(),
          [82, 76, 88, 80][i] || 78,
          now(), now()
        );
    }
  });
  tx();
}

function seedMetrics() {
  const posts = db.prepare(`SELECT id, published_at FROM posts WHERE status = 'published'`).all();
  if (posts.length === 0) return 0;

  let writes = 0;
  const today = new Date();
  for (const p of posts) {
    const pubDate = p.published_at ? new Date(p.published_at) : today;
    const daysSince = Math.max(1, Math.floor((today - pubDate) / (1000 * 60 * 60 * 24)));
    const span = Math.min(30, daysSince);
    // simulate a decay curve: early days high, then taper
    for (let d = 0; d < span; d++) {
      const date = new Date(today); date.setDate(today.getDate() - d);
      const dateIso = date.toISOString().slice(0, 10);
      const decay = Math.max(0.18, 1 / (1 + d * 0.15));
      const visitors = Math.round(80 + Math.random() * 120 * decay + 60 * decay);
      const views = Math.round(visitors * (1.2 + Math.random() * 0.4));
      metrics.upsertDailyMetric(p.id, dateIso, {
        visitors, views,
        avgDwellSec: Math.round(80 + Math.random() * 90),
        likes: Math.round(visitors * 0.04),
        comments: Math.round(visitors * 0.006),
        topRank: Math.max(1, Math.round(8 - d * 0.15 + Math.random() * 4)),
        inboundKeywords: [
          { kw: '카페 추천', count: Math.round(visitors * 0.25) },
          { kw: '성수동 카페', count: Math.round(visitors * 0.18) },
        ],
      });
      writes++;
    }
  }
  return writes;
}

function seedAffiliateLinks() {
  const cnt = db.prepare('SELECT COUNT(*) AS n FROM affiliate_links').get().n;
  if (cnt > 0) return 0;

  const posts = db.prepare(`SELECT id FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 4`).all();
  if (posts.length === 0) return 0;

  const products = [
    { name: '헬리녹스 체어원', price: 89000, thumb: null },
    { name: '다이슨 V15 디텍트',  price: 1090000, thumb: null },
    { name: '갤럭시 워치6 클래식', price: 449000, thumb: null },
    { name: '코베아 캠핑 의자',   price: 49900, thumb: null },
  ];
  let writes = 0;
  posts.forEach((p, i) => {
    const product = products[i % products.length];
    const id = uuid();
    const shortId = 'cp_' + id.slice(0, 8);
    db.prepare(`INSERT INTO affiliate_links
      (id, post_id, user_id, channel, short_id, target_url, product_name,
       product_price, thumbnail_url, inserted_at)
      VALUES (?, ?, NULL, 'coupang', ?, ?, ?, ?, ?, ?)`)
      .run(
        id, p.id, shortId,
        `https://link.coupang.com/${shortId}`,
        product.name, product.price, product.thumb, now()
      );
    writes++;
  });
  return writes;
}

function seedRevenue() {
  const today = new Date();
  const posts = db.prepare(`SELECT id FROM posts WHERE status = 'published'`).all();
  if (posts.length === 0) return 0;

  let writes = 0;
  const links = db.prepare('SELECT id, post_id FROM affiliate_links').all();
  const linkByPost = new Map(links.map(l => [l.post_id, l.id]));

  for (let d = 0; d < 30; d++) {
    const date = new Date(today); date.setDate(today.getDate() - d);
    const dateIso = date.toISOString().slice(0, 10);
    // AdPost: simulated daily total (KRW)
    const adpostTotal = Math.round(4000 + Math.random() * 8000);
    revenue.attributeAdPostDaily(null, dateIso, adpostTotal);
    writes++;
    // Coupang: per-post-affiliate clicks/conversions/amount
    for (const p of posts) {
      const linkId = linkByPost.get(p.id);
      if (!linkId) continue;
      const clicks = Math.round(Math.random() * 30);
      const conv   = Math.round(Math.random() * clicks * 0.1);
      const amount = Math.round(conv * (5000 + Math.random() * 12000));
      if (clicks === 0 && amount === 0) continue;
      revenue.insertRecord({
        userId: null, postId: p.id, affiliateLinkId: linkId,
        channel: 'coupang', date: dateIso,
        clicks, conversions: conv, amountKrw: amount,
      });
      writes++;
    }
  }
  return writes;
}

function run() {
  if (hasAnyData()) return { skipped: true };
  ensurePosts();
  const metricsWrites = seedMetrics();
  const linkWrites = seedAffiliateLinks();
  const revenueWrites = seedRevenue();
  return { metrics: metricsWrites, links: linkWrites, revenue: revenueWrites };
}

module.exports = { run };
