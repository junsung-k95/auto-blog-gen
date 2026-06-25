'use strict';

const express = require('express');
const metrics = require('../services/metrics');
const revenue = require('../services/revenue');

const router = express.Router();

/**
 * GET /api/dashboard?days=30
 * One-shot payload for the home screen: revenue summary, KPI tiles,
 * top recent posts.
 */
router.get('/dashboard', (req, res) => {
  const userId = req.user?.id || null;
  const days = parseInt(req.query.days, 10) || 30;

  const rev = revenue.aggregateForUser(userId, days);
  const visits = metrics.aggregateForUser(userId, days);
  const top = metrics.topPostsByVisitors(userId, days, 5);
  const slumping = metrics.slumpingPosts(userId, 14, 100);
  const perPostRev = revenue.perPost(userId, days, 5);

  // Merge per-post revenue into top-by-visitors for the dashboard table
  const revById = new Map(perPostRev.map(p => [p.id, p.amountKrw]));
  const topWithRevenue = top.map(p => ({ ...p, revenueKrw: revById.get(p.id) || 0 }));

  res.json({
    days,
    revenue: rev,
    visits: visits.totals,
    visitsDaily: visits.daily,
    topPosts: topWithRevenue,
    slumping,
  });
});

/** GET /api/posts/:id/metrics?days=30 — per-post time series */
router.get('/posts/:id/metrics', (req, res) => {
  const days = parseInt(req.query.days, 10) || 30;
  res.json({
    series: metrics.getSeries(req.params.id, days),
  });
});

/** GET /api/performance?days=30 — full ranking + slump list */
router.get('/performance', (req, res) => {
  const userId = req.user?.id || null;
  const days = parseInt(req.query.days, 10) || 30;
  res.json({
    days,
    visits: metrics.aggregateForUser(userId, days),
    topPosts: metrics.topPostsByVisitors(userId, days, 20),
    slumping: metrics.slumpingPosts(userId, 14, 100),
    revenuePerPost: revenue.perPost(userId, days, 20),
  });
});

/** GET /api/revenue?days=30 — full revenue dashboard data */
router.get('/revenue', (req, res) => {
  const userId = req.user?.id || null;
  const days = parseInt(req.query.days, 10) || 30;
  res.json({
    days,
    summary: revenue.aggregateForUser(userId, days),
    perPost: revenue.perPost(userId, days, 30),
    affiliateLinks: revenue.topAffiliateLinks(userId, days, 20),
    favorites: revenue.listFavoriteProducts(userId),
  });
});

/** GET /api/affiliate-links?days=30 */
router.get('/affiliate-links', (req, res) => {
  const userId = req.user?.id || null;
  const days = parseInt(req.query.days, 10) || 30;
  res.json(revenue.topAffiliateLinks(userId, days, 50));
});

/** POST /api/products/favorite — add a product to the library */
router.post('/products/favorite', (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    res.json(revenue.favoriteProduct(req.user.id, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
