'use strict';

const express = require('express');
const sponsors = require('../services/sponsors');

const router = express.Router();

router.get('/sponsors', (req, res) => {
  const userId = req.user?.id || null;
  res.json(sponsors.byStatus(userId));
});

router.post('/sponsors', (req, res) => {
  try {
    res.status(201).json(sponsors.create(req.user?.id || null, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/sponsors/:id', (req, res) => {
  try {
    res.json(sponsors.update(req.user?.id || null, req.params.id, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/sponsors/:id', (req, res) => {
  try {
    res.json(sponsors.remove(req.user?.id || null, req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
