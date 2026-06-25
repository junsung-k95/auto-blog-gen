'use strict';

const { db } = require('./index');

/**
 * Forward-only migrations. Each entry: { id, sql }.
 * Schema scope: M2 — users, blog_profiles, keywords, keyword_snapshots,
 * keyword_bookmarks. (Other tables — posts, metrics, revenue — arrive in M3~M5.)
 */
const MIGRATIONS = [
  {
    id: '001_init',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS blog_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        naver_username_enc TEXT,
        naver_api_password_enc TEXT,
        naver_blog_id TEXT,
        categories TEXT,         -- JSON array
        target_keywords TEXT,    -- JSON array
        weekly_goal INTEGER DEFAULT 5,
        golden_hours TEXT,       -- JSON array [7,21]
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_blog_profiles_user ON blog_profiles(user_id);

      CREATE TABLE IF NOT EXISTS keywords (
        id TEXT PRIMARY KEY,
        term TEXT UNIQUE NOT NULL,
        category TEXT,
        first_seen_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_keywords_category ON keywords(category);

      CREATE TABLE IF NOT EXISTS keyword_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword_id TEXT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
        captured_at TEXT NOT NULL,           -- ISO date (YYYY-MM-DD)
        blog_volume INTEGER,
        cafe_volume INTEGER,
        monthly_search INTEGER,
        competition_ratio REAL,
        trend_4w TEXT,                       -- JSON array of weekly trend values
        trend_growth_4w REAL,                -- last_week / first_week ratio
        est_cpc INTEGER,
        coupang_match_count INTEGER DEFAULT 0,
        score_total REAL,
        UNIQUE (keyword_id, captured_at)
      );

      CREATE INDEX IF NOT EXISTS idx_kw_snap_keyword ON keyword_snapshots(keyword_id);
      CREATE INDEX IF NOT EXISTS idx_kw_snap_score ON keyword_snapshots(captured_at, score_total DESC);

      CREATE TABLE IF NOT EXISTS keyword_bookmarks (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        keyword_id TEXT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
        state TEXT NOT NULL DEFAULT 'saved', -- 'saved' | 'ignored'
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, keyword_id)
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        run_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',  -- queued|running|done|failed
        payload TEXT,                            -- JSON
        attempts INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(status, run_at);
    `,
  },
  {
    id: '002_monetization',
    sql: `
      CREATE TABLE IF NOT EXISTS revenue_channels (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,             -- 'adpost' | 'coupang' | 'sponsor' | 'ali'
        credentials_enc TEXT,           -- encrypted JSON
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        UNIQUE (user_id, kind)
      );

      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        blog_profile_id TEXT REFERENCES blog_profiles(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        title TEXT,
        content_html TEXT,
        tags TEXT,
        category TEXT,
        scheduled_at TEXT,
        published_at TEXT,
        naver_post_id TEXT,
        ai_provider TEXT,
        token_cost_usd REAL,
        seo_score INTEGER,
        risk_flags TEXT,
        disclosure_kind TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
      CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

      CREATE TABLE IF NOT EXISTS post_keywords (
        post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        keyword_id TEXT NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'primary',
        rank_at_publish INTEGER,
        PRIMARY KEY (post_id, keyword_id)
      );

      CREATE TABLE IF NOT EXISTS affiliate_links (
        id TEXT PRIMARY KEY,
        post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        channel TEXT NOT NULL,
        short_id TEXT NOT NULL,
        target_url TEXT NOT NULL,
        product_name TEXT,
        product_price INTEGER,
        thumbnail_url TEXT,
        inserted_at TEXT NOT NULL,
        UNIQUE (short_id)
      );

      CREATE INDEX IF NOT EXISTS idx_affiliate_post ON affiliate_links(post_id);
    `,
  },
];

function migrate() {
  db.exec(`CREATE TABLE IF NOT EXISTS migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const applied = new Set(
    db.prepare('SELECT id FROM migrations').all().map(r => r.id)
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    const tx = db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO migrations (id, applied_at) VALUES (?, ?)')
        .run(m.id, new Date().toISOString());
    });
    tx();
    console.log(`[migration] applied ${m.id}`);
  }
}

module.exports = { migrate };
