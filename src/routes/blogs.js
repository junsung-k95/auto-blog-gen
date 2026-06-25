'use strict';

const express = require('express');
const { requireAuth } = require('../services/auth');
const svc = require('../services/blogProfiles');

const router = express.Router();

router.get('/blogs', requireAuth, (req, res) => {
  res.json(svc.listForUser(req.user.id));
});

router.post('/blogs', requireAuth, (req, res) => {
  try {
    res.json(svc.createForUser(req.user.id, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/blogs/:id', requireAuth, (req, res) => {
  const p = svc.getForUser(req.user.id, req.params.id);
  if (!p) return res.status(404).json({ error: '없음' });
  res.json(p);
});

router.patch('/blogs/:id', requireAuth, (req, res) => {
  try {
    res.json(svc.updateForUser(req.user.id, req.params.id, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/blogs/:id', requireAuth, (req, res) => {
  svc.removeForUser(req.user.id, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
