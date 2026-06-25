'use strict';

const express = require('express');
const keywords = require('../services/keywords');
const jobs = require('../services/jobQueue');

const router = express.Router();

/** GET /api/keywords/recommend?category=&limit= */
router.get('/keywords/recommend', (req, res) => {
  const category = req.query.category && req.query.category !== 'all' ? req.query.category : null;
  const limit = Math.min(parseInt(req.query.limit, 10) || 24, 100);
  const userId = req.user?.id || null;
  res.json(keywords.recommend({ category, limit, userId }));
});

/** GET /api/keywords/:id — detail + history */
router.get('/keywords/:id', (req, res) => {
  const k = keywords.getById(req.params.id, req.user?.id || null);
  if (!k) return res.status(404).json({ error: '없음' });
  res.json(k);
});

/** POST /api/keywords/:id/bookmark { state: 'saved'|'ignored'|null } */
router.post('/keywords/:id/bookmark', (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    const state = req.body?.state ?? 'saved';
    res.json(keywords.bookmark(req.user.id, req.params.id, state));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** POST /api/keywords/refresh — manual trigger (queues a refresh job) */
router.post('/keywords/refresh', (req, res) => {
  const seeds = req.body?.seeds;
  const id = jobs.enqueue('refresh_keywords', { seeds });
  res.json({ queued: id });
});

module.exports = router;
