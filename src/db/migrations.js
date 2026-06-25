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
  {
    id: '004_sponsors',
    sql: `
      CREATE TABLE IF NOT EXISTS sponsors (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        company TEXT NOT NULL,
        contact_email TEXT,
        product_name TEXT,
        budget_krw INTEGER,
        status TEXT NOT NULL DEFAULT 'proposed',
        notes TEXT,
        received_at TEXT NOT NULL,
        due_at TEXT,
        post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sponsors_user ON sponsors(user_id, status);

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        link TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);
    `,
  },
  {
    id: '003_performance',
    sql: `
      CREATE TABLE IF NOT EXISTS post_metrics (
        post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        date TEXT NOT NULL,           -- YYYY-MM-DD
        visitors INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        avg_dwell_sec INTEGER DEFAULT 0,
        inbound_keywords TEXT,        -- JSON [{kw,count}]
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        top_rank INTEGER,
        PRIMARY KEY (post_id, date)
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_date ON post_metrics(date);

      CREATE TABLE IF NOT EXISTS revenue_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
        affiliate_link_id TEXT REFERENCES affiliate_links(id) ON DELETE SET NULL,
        channel TEXT NOT NULL,        -- 'adpost' | 'coupang' | 'sponsor'
        date TEXT NOT NULL,           -- YYYY-MM-DD
        clicks INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        amount_krw INTEGER DEFAULT 0,
        raw_payload TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_revenue_user_date ON revenue_records(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_revenue_post ON revenue_records(post_id);
      CREATE INDEX IF NOT EXISTS idx_revenue_channel_date ON revenue_records(channel, date);

      CREATE TABLE IF NOT EXISTS keyword_rank_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
        keyword_id TEXT REFERENCES keywords(id) ON DELETE CASCADE,
        captured_at TEXT NOT NULL,    -- YYYY-MM-DD
        rank INTEGER,                 -- Naver search rank (1=top), NULL=not ranked
        UNIQUE (post_id, keyword_id, captured_at)
      );

      CREATE INDEX IF NOT EXISTS idx_rank_post ON keyword_rank_history(post_id, captured_at);

      CREATE TABLE IF NOT EXISTS favorite_products (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        name TEXT,
        price INTEGER,
        thumbnail_url TEXT,
        product_url TEXT,
        category TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (user_id, product_id)
      );
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
