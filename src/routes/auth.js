'use strict';

const express = require('express');
const { signup, login } = require('../services/auth');

const router = express.Router();

router.post('/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = await signup(email, password);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.get('/auth/me', (req, res) => {
  res.json(req.user || null);
});

module.exports = router;
