'use strict';

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
const HISTORY_FILE = path.join(__dirname, '../../data/history.json');

async function readHistory() {
  try {
    const raw = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeHistory(entries) {
  await fs.mkdir(path.dirname(HISTORY_FILE), { recursive: true });
  await fs.writeFile(HISTORY_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

// Called directly from publish.js
async function saveHistory({ title, tags, category, postId, preview }) {
  const entries = await readHistory();
  const entry = {
    id: Date.now().toString(),
    title,
    tags: tags || [],
    category: category || '',
    postId,
    preview: (preview || '').slice(0, 200),
    publishedAt: new Date().toISOString(),
  };
  entries.unshift(entry);
  if (entries.length > 50) entries.splice(50);
  await writeHistory(entries);
  return entry;
}

// GET /api/history
router.get('/history', async (_req, res) => {
  try {
    res.json(await readHistory());
  } catch (err) {
    res.status(500).json({ error: '히스토리를 불러오는 데 실패했습니다.' });
  }
});

module.exports = router;
module.exports.saveHistory = saveHistory;
