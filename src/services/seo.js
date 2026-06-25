'use strict';

/**
 * Naver Blog SEO scoring and low-quality risk diagnostics.
 * Pure function — pass { title, contentHtml, primaryKeyword, tags } → get score + flags + advice.
 *
 * Scoring rubric matches docs/03-requirements.md §3.5.2.
 *   100 points total across 9 items.
 */

// Naver low-quality risk red flags (heuristic). These are not exhaustive;
// they reflect commonly reported patterns from blogger guides.
const FORBIDDEN_WORDS = [
  '최저가', '대박', '특가', '강추', '필수템', '미친', '실화',
  // ad/spam markers
  '클릭', '광고문의', '카톡상담', 'DM', 'P.S',
];

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countMatches(text, needle) {
  if (!needle) return 0;
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const m = text.match(re);
  return m ? m.length : 0;
}

function scorePost({ title = '', contentHtml = '', primaryKeyword = '', tags = [] }) {
  const text = stripHtml(contentHtml);
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const items = [];
  const flags = [];

  // (1) Primary keyword in title — 20pt
  const kwInTitle = primaryKeyword && title.includes(primaryKeyword);
  items.push({ id: 'kw_in_title', label: '제목에 주 키워드 포함', max: 20, got: kwInTitle ? 20 : 0 });

  // (2) Title length 25–45 chars — 10pt
  const tlen = [...title].length;
  let titleLenScore = 0;
  if (tlen >= 25 && tlen <= 45) titleLenScore = 10;
  else if (tlen >= 18 && tlen <= 55) titleLenScore = 6;
  else if (tlen >= 10) titleLenScore = 3;
  items.push({ id: 'title_len', label: `제목 길이 (현재 ${tlen}자, 권장 25–45)`, max: 10, got: titleLenScore });

  // (3) Body length ≥ 1000, full at ≥ 1500 — 15pt
  let bodyScore = 0;
  if (charCount >= 1500) bodyScore = 15;
  else if (charCount >= 1000) bodyScore = 12;
  else if (charCount >= 600) bodyScore = 7;
  else if (charCount >= 300) bodyScore = 3;
  items.push({ id: 'body_len', label: `본문 글자수 (현재 ${charCount}자, 권장 1500+)`, max: 15, got: bodyScore });

  // (4) Primary keyword body density 1%–3% — 15pt
  let densityScore = 0;
  let density = 0;
  if (primaryKeyword && charCount > 0) {
    const occ = countMatches(text, primaryKeyword);
    density = (occ * primaryKeyword.length) / charCount;
    if (density >= 0.01 && density <= 0.03) densityScore = 15;
    else if (density > 0 && density < 0.05) densityScore = 8;
  }
  items.push({ id: 'kw_density', label: `주 키워드 밀도 (현재 ${(density * 100).toFixed(2)}%, 권장 1–3%)`, max: 15, got: densityScore });

  // (5) H2/H3 structure ≥ 3 — 10pt
  const headingCount = (contentHtml.match(/<h[23][^>]*>/gi) || []).length;
  let headingScore = 0;
  if (headingCount >= 3) headingScore = 10;
  else if (headingCount >= 2) headingScore = 6;
  else if (headingCount >= 1) headingScore = 3;
  items.push({ id: 'headings', label: `H2/H3 구조 (현재 ${headingCount}개, 권장 3+)`, max: 10, got: headingScore });

  // (6) Image count ≥ 3 — 10pt
  const imgs = (contentHtml.match(/<img\b[^>]*>/gi) || []);
  const imgPlaceholders = (contentHtml.match(/\[사진\d+\]/g) || []);
  const imageCount = imgs.length + imgPlaceholders.length;
  let imgScore = 0;
  if (imageCount >= 3) imgScore = 10;
  else if (imageCount === 2) imgScore = 6;
  else if (imageCount === 1) imgScore = 3;
  items.push({ id: 'images', label: `이미지 수 (현재 ${imageCount}장, 권장 3+)`, max: 10, got: imgScore });

  // (7) Image alt text presence — 5pt
  let altScore = 5;
  if (imgs.length > 0) {
    const withAlt = imgs.filter(t => /\balt=/.test(t)).length;
    altScore = imgs.length > 0 ? Math.round((withAlt / imgs.length) * 5) : 5;
  }
  items.push({ id: 'image_alt', label: `이미지 alt 텍스트`, max: 5, got: altScore });

  // (8) Tags 5–10 — 10pt
  const tagCount = Array.isArray(tags) ? tags.length : 0;
  let tagScore = 0;
  if (tagCount >= 5 && tagCount <= 10) tagScore = 10;
  else if (tagCount >= 3) tagScore = 6;
  else if (tagCount >= 1) tagScore = 3;
  items.push({ id: 'tags', label: `태그 수 (현재 ${tagCount}, 권장 5–10)`, max: 10, got: tagScore });

  // (9) External link ratio ≤ 10% — 5pt
  const externalLinks = (contentHtml.match(/<a\s+[^>]*href=["']https?:\/\/[^"']+["'][^>]*>/gi) || []).length;
  const linkRatio = wordCount > 0 ? externalLinks / wordCount : 0;
  let linkScore = externalLinks <= 5 ? 5 : (externalLinks <= 10 ? 2 : 0);
  items.push({ id: 'external_links', label: `외부 링크 ${externalLinks}개`, max: 5, got: linkScore });

  const total = items.reduce((sum, it) => sum + it.got, 0);

  // ── Risk flags (low-quality / red-flag heuristics)
  const lowText = text.toLowerCase();
  const foundForbidden = FORBIDDEN_WORDS.filter(w => lowText.includes(w.toLowerCase()));
  if (foundForbidden.length > 0) {
    flags.push({ severity: 'warning', code: 'forbidden_words', message: `과장/금칙 단어 ${foundForbidden.length}개 감지: ${foundForbidden.slice(0, 4).join(', ')}` });
  }
  if (externalLinks > 6) {
    flags.push({ severity: 'warning', code: 'too_many_links', message: `외부 링크 ${externalLinks}개 — 5개 이하 권장` });
  }
  if (charCount > 0 && charCount < 500) {
    flags.push({ severity: 'danger', code: 'too_short', message: `본문이 너무 짧음 (${charCount}자)` });
  }
  // Repetitive sentence detection (>=3 identical 10-char snippets)
  const sentences = text.split(/[.!?]/);
  const snippetMap = new Map();
  for (const s of sentences) {
    const t = s.trim().slice(0, 12);
    if (t.length >= 8) snippetMap.set(t, (snippetMap.get(t) || 0) + 1);
  }
  const repeats = [...snippetMap.values()].filter(c => c >= 3).length;
  if (repeats > 0) flags.push({ severity: 'warning', code: 'repetitive', message: '반복 패턴이 감지되었습니다' });

  // ── Advice (next-step suggestions)
  const advice = items
    .filter(it => it.got < it.max)
    .sort((a, b) => (b.max - b.got) - (a.max - a.got))
    .slice(0, 3)
    .map(it => `${it.label} — +${it.max - it.got}점 가능`);

  return { total, items, flags, advice };
}

module.exports = { scorePost };
