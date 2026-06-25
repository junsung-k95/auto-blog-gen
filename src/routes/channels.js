'use strict';

const express = require('express');
const { requireAuth } = require('../services/auth');
const svc = require('../services/channels');

const router = express.Router();

router.get('/channels', requireAuth, (req, res) => {
  res.json(svc.listForUser(req.user.id));
});

router.put('/channels/:kind', requireAuth, (req, res) => {
  try {
    res.json(svc.upsertForUser(req.user.id, req.params.kind, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/channels/:id', requireAuth, (req, res) => {
  svc.removeForUser(req.user.id, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
