'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const { migrate } = require('./db/migrations');
const keywords = require('./services/keywords');
const jobs = require('./services/jobQueue');
const { authMiddleware } = require('./services/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data/ exists, run migrations, seed demo keywords if DB is empty.
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
migrate();
try { keywords.seedDemo(); } catch (e) { console.warn('[seed:keywords]', e.message); }
try {
  const r = require('./services/perfSeed').run();
  if (!r.skipped) console.log('[seed:performance]', r);
} catch (e) { console.warn('[seed:performance]', e.message); }
try {
  const r = require('./services/sponsors').seedDemo();
  if (!r.skipped) console.log('[seed:sponsors]', r);
} catch (e) { console.warn('[seed:sponsors]', e.message); }
try {
  const r = require('./services/notifications').seedDemo();
  if (!r.skipped) console.log('[seed:notifications]', r);
} catch (e) { console.warn('[seed:notifications]', e.message); }

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', authMiddleware); // soft mode: req.user may be null

// Routes
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/blogs'));
app.use('/api', require('./routes/keywords'));
app.use('/api', require('./routes/channels'));
app.use('/api', require('./routes/coupang'));
app.use('/api', require('./routes/seo'));
app.use('/api', require('./routes/posts'));
app.use('/api', require('./routes/performance'));
app.use('/api', require('./routes/transcribe')(upload));
app.use('/api', require('./routes/generate')(upload));
app.use('/api', require('./routes/publish'));
app.use('/api', require('./routes/trends'));
app.use('/api', require('./routes/history'));
app.use('/api', require('./routes/sponsors'));
app.use('/api', require('./routes/notifications'));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`auto-blog-gen running on http://localhost:${PORT}`);
  jobs.start();
});
