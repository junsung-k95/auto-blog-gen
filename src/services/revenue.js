'use strict';

const { db, uuid, now } = require('../db');

/**
 * Insert a revenue record.
 * payload: { userId, postId?, affiliateLinkId?, channel, date, clicks, conversions, amount_krw, rawPayload? }
 */
function insertRecord(payload) {
  db.prepare(`INSERT INTO revenue_records
    (user_id, post_id, affiliate_link_id, channel, date, clicks, conversions, amount_krw, raw_payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      payload.userId || null,
      payload.postId || null,
      payload.affiliateLinkId || null,
      payload.channel,
      payload.date,
      payload.clicks || 0,
      payload.conversions || 0,
      payload.amountKrw || 0,
      payload.rawPayload ? JSON.stringify(payload.rawPayload) : null,
    );
}

/**
 * AdPost revenue is reported per-day, not per-post.
 * Distribute the daily total proportionally by each post's views that day.
 * Idempotent: re-runs replace prior pro-rated rows for (channel='adpost', date).
 */
function attributeAdPostDaily(userId, date, dailyTotalKrw) {
  // Wipe previous adpost rows for this date (so we can re-attribute)
  db.prepare(`DELETE FROM revenue_records
    WHERE user_id IS ? AND channel = 'adpost' AND date = ?`)
    .run(userId || null, date);

  const userFilter = userId ? '(p.user_id = ? OR p.user_id IS NULL)' : '(p.user_id IS NULL)';
  const args = userId ? [userId, date] : [date];
  const rows = db.prepare(`
    SELECT p.id AS post_id, COALESCE(m.views, 0) AS views
    FROM posts p LEFT JOIN post_metrics m ON m.post_id = p.id AND m.date = ?
    WHERE ${userFilter} AND p.status = 'published'
  `).all(args[args.length - 1], ...(userId ? [userId] : []));

  const totalViews = rows.reduce((s, r) => s + r.views, 0);
  if (totalViews === 0) {
    insertRecord({
      userId, channel: 'adpost', date,
      amountKrw: dailyTotalKrw, clicks: 0, conversions: 0,
      rawPayload: { note: 'no views — unallocated' },
    });
    return { totalKrw: dailyTotalKrw, totalViews: 0, distributed: 0 };
  }

  let distributed = 0;
  for (const r of rows) {
    if (r.views === 0) continue;
    const portion = Math.round((r.views / totalViews) * dailyTotalKrw);
    distributed += portion;
    insertRecord({
      userId, postId: r.post_id, channel: 'adpost', date,
      amountKrw: portion,
      rawPayload: { views: r.views, dailyTotalKrw, totalViews },
    });
  }
  return { totalKrw: dailyTotalKrw, totalViews, distributed };
}

/** Aggregated revenue for the user in the window. */
function aggregateForUser(userId, days = 30) {
  const since = new Date(); since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);
  const args = userId ? [userId, sinceIso] : [sinceIso];
  const userFilter = userId ? '(user_id = ? OR user_id IS NULL)' : '(user_id IS NULL)';
  const byChannel = db.prepare(`
    SELECT channel,
      COALESCE(SUM(amount_krw), 0) AS amount,
      COALESCE(SUM(clicks), 0) AS clicks,
      COALESCE(SUM(conversions), 0) AS conversions
    FROM revenue_records WHERE ${userFilter} AND date >= ?
    GROUP BY channel
  `).all(...args);

  const daily = db.prepare(`
    SELECT date, channel, COALESCE(SUM(amount_krw), 0) AS amount
    FROM revenue_records WHERE ${userFilter} AND date >= ?
    GROUP BY date, channel ORDER BY date
  `).all(...args);

  const total = byChannel.reduce((s, r) => s + r.amount, 0);
  return { total, byChannel, daily };
}

/** Revenue rollup per published post. */
function perPost(userId, days = 30, limit = 50) {
  const since = new Date(); since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);
  const userFilter = userId ? '(p.user_id = ? OR p.user_id IS NULL)' : '(p.user_id IS NULL)';
  const args = userId ? [userId, sinceIso, limit] : [sinceIso, limit];
  return db.prepare(`
    SELECT p.id, p.title, p.status, p.published_at,
      COALESCE(SUM(r.amount_krw), 0) AS amount,
      COALESCE(SUM(r.clicks), 0) AS clicks,
      COALESCE(SUM(r.conversions), 0) AS conversions
    FROM posts p LEFT JOIN revenue_records r ON r.post_id = p.id AND r.date >= ?
    WHERE ${userFilter} AND p.status = 'published'
    GROUP BY p.id ORDER BY amount DESC LIMIT ?
  `).all(...args).map(r => ({
    id: r.id, title: r.title, status: r.status, publishedAt: r.published_at,
    amountKrw: r.amount, clicks: r.clicks, conversions: r.conversions,
  }));
}

/** Top performing affiliate links (revenue contribution). */
function topAffiliateLinks(userId, days = 30, limit = 10) {
  const since = new Date(); since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString().slice(0, 10);
  const userFilter = userId ? '(a.user_id = ? OR a.user_id IS NULL)' : '(a.user_id IS NULL)';
  const args = userId ? [userId, sinceIso, limit] : [sinceIso, limit];
  return db.prepare(`
    SELECT a.id, a.product_name, a.channel, a.short_id, a.product_price, a.thumbnail_url,
      COUNT(DISTINCT a.post_id) AS posts_using,
      COALESCE(SUM(r.amount_krw), 0) AS amount,
      COALESCE(SUM(r.clicks), 0) AS clicks,
      COALESCE(SUM(r.conversions), 0) AS conversions
    FROM affiliate_links a
    LEFT JOIN revenue_records r ON r.affiliate_link_id = a.id AND r.date >= ?
    WHERE ${userFilter}
    GROUP BY a.id ORDER BY amount DESC LIMIT ?
  `).all(...args).map(r => ({
    id: r.id, productName: r.product_name, channel: r.channel, shortId: r.short_id,
    productPrice: r.product_price, thumbnailUrl: r.thumbnail_url,
    postsUsing: r.posts_using, amountKrw: r.amount,
    clicks: r.clicks, conversions: r.conversions,
  }));
}

/** Favorite-products library (M5.7 supports this). */
function listFavoriteProducts(userId) {
  if (!userId) return [];
  return db.prepare('SELECT * FROM favorite_products WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId)
    .map(r => ({
      id: r.id, productId: r.product_id, name: r.name, price: r.price,
      thumbnailUrl: r.thumbnail_url, productUrl: r.product_url,
      category: r.category, createdAt: r.created_at,
    }));
}

function favoriteProduct(userId, product) {
  if (!userId || !product?.productId) throw new Error('userId, product 필요');
  const id = uuid();
  db.prepare(`INSERT OR REPLACE INTO favorite_products
    (id, user_id, product_id, name, price, thumbnail_url, product_url, category, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      id, userId, product.productId,
      product.name || '', product.price || null,
      product.thumbnailUrl || product.productImage || null,
      product.productUrl || null,
      product.category || null,
      now()
    );
  return { id, productId: product.productId };
}

module.exports = {
  insertRecord, attributeAdPostDaily,
  aggregateForUser, perPost, topAffiliateLinks,
  listFavoriteProducts, favoriteProduct,
};
