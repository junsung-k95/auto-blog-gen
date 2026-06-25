'use strict';

const express = require('express');
const notifs = require('../services/notifications');

const router = express.Router();

router.get('/notifications', (req, res) => {
  const userId = req.user?.id || null;
  res.json({
    items: notifs.list(userId),
    unread: notifs.unreadCount(userId),
  });
});

router.get('/notifications/count', (req, res) => {
  res.json({ unread: notifs.unreadCount(req.user?.id || null) });
});

router.post('/notifications/read-all', (req, res) => {
  res.json(notifs.markAllRead(req.user?.id || null));
});

router.post('/notifications/:id/read', (req, res) => {
  res.json(notifs.markRead(req.user?.id || null, req.params.id));
});

module.exports = router;
