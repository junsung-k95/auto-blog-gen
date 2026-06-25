'use strict';

const coupang = require('./coupang');

const KOREAN_STOPWORDS = new Set([
  '그리고', '하지만', '저는', '제가', '우리', '오늘', '이번', '정말', '진짜', '너무',
  '많이', '아주', '조금', '바로', '같이', '함께', '여기', '저기', '거기', '이제',
  '항상', '가장', '먼저', '나중에', '그래서', '왜냐하면', '특히', '예를', '다음',
  '있어요', '있는데', '있습니다', '있었어요', '없어요', '이에요', '예요', '입니다',
  '해서', '하고', '하면', '해야', '되는', '되어', '있을', '있던', '이라는', '이라고',
]);

/**
 * Extract candidate product nouns from blog HTML/text.
 * Naive heuristic: pick frequent 2~4 syllable Korean nouns, skip stopwords.
 * Returns up to `topN` distinct terms ordered by frequency.
 */
function extractCandidateNouns(textOrHtml, topN = 5) {
  const text = String(textOrHtml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  // Split on whitespace and Korean particle endings
  const tokens = text
    .split(/[\s,.!?·•"'`()\[\]{}]+/)
    .map(t => t.replace(/[은는이가을를과와도의에서에게로으로]$/u, ''))
    .filter(t => /^[가-힣]{2,8}$/.test(t) && !KOREAN_STOPWORDS.has(t));
  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term, count]) => ({ term, count }));
}

/**
 * Match products for a post's title + body.
 * Pipeline:
 *   1. Extract top candidate nouns
 *   2. Combine with title-derived keywords
 *   3. Query Coupang Partners for each → flatten + dedupe by productId
 *   4. Score by overlap of product name with the source terms
 */
async function matchProducts({ title = '', content = '', seedKeyword = null, perTerm = 3, max = 6 }) {
  const seeds = new Set();
  if (seedKeyword) seeds.add(seedKeyword);
  if (title) {
    title.split(/[\s,.!?·•]+/).filter(t => /^[가-힣]{2,8}$/.test(t)).forEach(t => seeds.add(t));
  }
  extractCandidateNouns(content, 4).forEach(n => seeds.add(n.term));

  const queries = [...seeds].slice(0, 4);
  if (queries.length === 0) return { queries: [], products: [] };

  const buckets = await Promise.all(queries.map(q => coupang.searchProducts(q, perTerm)));
  const seen = new Map();
  buckets.forEach((products, i) => {
    for (const p of products) {
      if (!p || !p.productId) continue;
      if (!seen.has(p.productId)) {
        seen.set(p.productId, { ...p, _matchedBy: [queries[i]] });
      } else {
        seen.get(p.productId)._matchedBy.push(queries[i]);
      }
    }
  });

  const ranked = [...seen.values()]
    .sort((a, b) => (b._matchedBy.length - a._matchedBy.length) || ((b.price || 0) - (a.price || 0)))
    .slice(0, max);

  return { queries, products: ranked };
}

/**
 * Build an HTML block for an affiliate product card ready to paste in body.
 * Includes thumbnail + price + tracked link + mandatory disclosure.
 */
function buildProductCardHtml(product, deepLink) {
  const url = deepLink || product.productUrl;
  const price = product.price ? `₩${Number(product.price).toLocaleString('ko-KR')}` : '';
  const img = product.productImage
    ? `<img src="${product.productImage}" alt="${escapeHtml(product.name)}" style="max-width:120px;border-radius:8px;vertical-align:middle;margin-right:12px;" />`
    : '';
  const tag = product._fallback ? '검색' : '쿠팡파트너스';
  return `<div style="display:flex;align-items:center;padding:12px;border:1px solid #e5e7eb;border-radius:10px;margin:16px 0;">
${img}<div style="flex:1">
<div style="font-weight:600;">${escapeHtml(product.name)}</div>
${price ? `<div style="color:#6b7280;margin-top:4px;">${price}</div>` : ''}
<a href="${url}" target="_blank" rel="nofollow sponsored noopener" style="display:inline-block;margin-top:8px;padding:6px 14px;background:#f59e0b;color:white;border-radius:6px;text-decoration:none;font-size:13px;">${tag}에서 보기 →</a>
</div></div>`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

module.exports = { extractCandidateNouns, matchProducts, buildProductCardHtml };
