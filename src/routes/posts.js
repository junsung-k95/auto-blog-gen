'use strict';

const express = require('express');
const svc = require('../services/posts');
const jobs = require('../services/jobQueue');

const router = express.Router();

const VALID_STATUS = new Set(['draft', 'review', 'scheduled', 'publishing', 'published', 'failed']);

/** GET /api/posts?status=&from=&to=&limit= */
router.get('/posts', (req, res) => {
  const userId = req.user?.id || null;
  res.json(svc.listForUser(userId, {
    status: req.query.status || null,
    from: req.query.from || null,
    to: req.query.to || null,
    limit: parseInt(req.query.limit, 10) || 100,
  }));
});

/** GET /api/posts/counts — number of posts per status (used by inbox tabs) */
router.get('/posts/counts', (req, res) => {
  res.json(svc.countsByStatus(req.user?.id || null));
});

/** POST /api/posts — create draft / scheduled post */
router.post('/posts', (req, res) => {
  try {
    const input = req.body || {};
    if (input.status && !VALID_STATUS.has(input.status)) {
      return res.status(400).json({ error: '잘못된 상태 값' });
    }
    const post = svc.createForUser(req.user?.id || null, input);
    if (post.status === 'scheduled' && post.scheduledAt) {
      jobs.enqueue('publish_post', { postId: post.id }, new Date(post.scheduledAt));
    }
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** GET /api/posts/:id — fetch one */
router.get('/posts/:id', (req, res) => {
  const p = svc.getForUser(req.user?.id || null, req.params.id);
  if (!p) return res.status(404).json({ error: '없음' });
  res.json(p);
});

/** PATCH /api/posts/:id — generic update (incl. status transitions) */
router.patch('/posts/:id', (req, res) => {
  try {
    const userId = req.user?.id || null;
    const patch = req.body || {};
    if (patch.status && !VALID_STATUS.has(patch.status)) {
      return res.status(400).json({ error: '잘못된 상태 값' });
    }
    const post = svc.updateForUser(userId, req.params.id, patch);
    // (Re)schedule publish job when scheduledAt changes
    if (post.status === 'scheduled' && post.scheduledAt) {
      jobs.enqueue('publish_post', { postId: post.id }, new Date(post.scheduledAt));
    }
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** DELETE /api/posts/:id */
router.delete('/posts/:id', (req, res) => {
  svc.removeForUser(req.user?.id || null, req.params.id);
  res.json({ ok: true });
});

/** POST /api/posts/:id/schedule — convenience for scheduled_at update */
router.post('/posts/:id/schedule', (req, res) => {
  try {
    const userId = req.user?.id || null;
    const at = req.body?.scheduledAt;
    if (!at) return res.status(400).json({ error: 'scheduledAt 필요' });
    const post = svc.updateForUser(userId, req.params.id, {
      status: 'scheduled', scheduledAt: at,
    });
    jobs.enqueue('publish_post', { postId: post.id }, new Date(at));
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** DELETE /api/posts/:id/schedule — cancel schedule, back to draft */
router.delete('/posts/:id/schedule', (req, res) => {
  try {
    const post = svc.updateForUser(req.user?.id || null, req.params.id, {
      status: 'draft', scheduledAt: null,
    });
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/** GET /api/calendar?from&to — agenda items for the calendar view */
router.get('/calendar', (req, res) => {
  const userId = req.user?.id || null;
  const items = svc.listForUser(userId, {
    status: null,
    from: req.query.from || null,
    to: req.query.to || null,
    limit: 500,
  }).filter(p => p.scheduledAt || p.publishedAt);
  res.json(items.map(p => ({
    id: p.id,
    title: p.title,
    status: p.status,
    at: p.scheduledAt || p.publishedAt,
    seoScore: p.seoScore,
    disclosureKind: p.disclosureKind,
  })));
});

module.exports = router;
