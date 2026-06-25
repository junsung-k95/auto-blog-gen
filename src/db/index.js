'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const IS_VERCEL = !!process.env.VERCEL;
const DB_DIR = IS_VERCEL ? '/tmp/auto-blog-gen' : path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'app.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma(IS_VERCEL ? 'journal_mode = MEMORY' : 'journal_mode = WAL');
db.pragma('foreign_keys = ON');

function uuid() {
  // RFC 4122 v4 lite (good enough for app-internal IDs)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function now() { return new Date().toISOString(); }

module.exports = { db, uuid, now, DB_PATH };
