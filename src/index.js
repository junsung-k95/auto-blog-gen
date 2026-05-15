'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data/ directory exists for history storage
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', require('./routes/transcribe')(upload));
app.use('/api', require('./routes/generate')(upload));
app.use('/api', require('./routes/publish'));
app.use('/api', require('./routes/trends'));
app.use('/api', require('./routes/history'));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`auto-blog-gen running on http://localhost:${PORT}`);
});
