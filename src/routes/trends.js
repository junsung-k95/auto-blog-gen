'use strict';

const express = require('express');
const router = express.Router();

// Naver Open API helpers using Node 20 built-in fetch
async function naverGet(path) {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) throw new Error('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET not configured');
  const res = await fetch(`https://openapi.naver.com${path}`, {
    headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret },
  });
  if (!res.ok) throw new Error(`Naver API ${res.status}`);
  return res.json();
}

async function naverPost(path, body) {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) throw new Error('NAVER_CLIENT_ID / NAVER_CLIENT_SECRET not configured');
  const res = await fetch(`https://openapi.naver.com${path}`, {
    method: 'POST',
    headers: {
      'X-Naver-Client-Id': id,
      'X-Naver-Client-Secret': secret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Naver DataLab ${res.status}`);
  return res.json();
}

// Step 1: Extract search-optimized keywords from generated content
// Uses gpt-4o-mini (cheap) → falls back to title word split
async function extractKeywords(title, contentText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `다음 블로그 포스팅에서 네이버 검색에 최적화된 핵심 키워드 5개를 추출하세요.\n키워드만 쉼표로 구분해 한 줄로 응답하세요.\n\n제목: ${title}\n내용: ${contentText.slice(0, 600)}`,
          }],
          max_tokens: 80,
          temperature: 0.3,
        }),
      });
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || '';
      const kws = raw.split(',').map(k => k.trim().replace(/^["'\s]+|["'\s]+$/g, '')).filter(k => k.length > 0);
      if (kws.length >= 2) return kws.slice(0, 5);
    } catch (_) { /* fallback */ }
  }
  return title.split(/[\s,]+/).filter(w => w.length > 1).slice(0, 5);
}

// Step 4: LLM re-generates title + tags using trend insight
async function optimizeTitleTags(originalTitle, keywords, blogSearch) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { title: originalTitle, tags: keywords };

  const summary = keywords.map((kw, i) => {
    const total = blogSearch[i]?.total;
    return `"${kw}": ${total != null ? Number(total).toLocaleString() + '개' : '데이터 없음'}`;
  }).join(', ');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `블로그 포스팅 제목을 SEO 최적화해주세요.\n\n원래 제목: ${originalTitle}\n키워드별 네이버 블로그 검색 수: ${summary}\n\n규칙:\n- 검색 수가 너무 많지 않은(적당한 경쟁) 키워드 포함\n- 자연스러운 한국어, 30자 이내\n- 클릭률 높은 제목\n\n아래 JSON 형식으로만 응답:\n{"title":"최적화된 제목","tags":["태그1","태그2","태그3","태그4","태그5"]}`,
        }],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]+\}/);
    if (match) return JSON.parse(match[0]);
  } catch (_) { /* fallback */ }

  return { title: originalTitle, tags: keywords };
}

/**
 * POST /api/trends
 * Body: { title, content }
 *
 * 키워드 선정 흐름:
 *   1. 생성된 제목+내용 → gpt-4o-mini로 검색 최적화 키워드 자동 추출
 *   2. 추출 키워드 → Naver 블로그 검색 수 조회 (경쟁 포화도 파악)
 *   3. 추출 키워드 → Naver DataLab 최근 3개월 트렌드 조회
 *   4. 트렌드 데이터 + 키워드 → LLM이 최적화된 제목/태그 생성
 */
router.post('/trends', async (req, res) => {
  try {
    const { title = '', content = '' } = req.body;
    if (!title && !content) {
      return res.status(400).json({ error: '제목 또는 내용이 필요합니다.' });
    }

    const contentText = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
    const hasNaverAPI = !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);

    // Step 1: Extract keywords
    const keywords = await extractKeywords(title, contentText);

    // Step 2: Blog search count per keyword
    const blogSearch = [];
    if (hasNaverAPI) {
      for (const kw of keywords) {
        try {
          const result = await naverGet(`/v1/search/blog.json?query=${encodeURIComponent(kw)}&display=1`);
          blogSearch.push({ keyword: kw, total: result.total ?? 0 });
        } catch (e) {
          blogSearch.push({ keyword: kw, total: null });
        }
      }
    } else {
      keywords.forEach(kw => blogSearch.push({ keyword: kw, total: null }));
    }

    // Step 3: DataLab trend (3 months, weekly)
    let trendData = null;
    if (hasNaverAPI && keywords.length > 0) {
      try {
        const end = new Date();
        const start = new Date();
        start.setMonth(start.getMonth() - 3);
        const fmt = d => d.toISOString().slice(0, 10);
        trendData = await naverPost('/v1/datalab/search', {
          startDate: fmt(start),
          endDate: fmt(end),
          timeUnit: 'week',
          keywordGroups: keywords.slice(0, 5).map(kw => ({ groupName: kw, keywords: [kw] })),
        });
      } catch (_) { /* optional */ }
    }

    // Step 4: Optimize title and tags with trend insight
    const { title: suggestedTitle, tags: suggestedTags } = await optimizeTitleTags(title, keywords, blogSearch);

    res.json({ keywords, blogSearch, trendData, suggestedTitle, suggestedTags });
  } catch (err) {
    console.error('trends error:', err.message);
    res.status(500).json({ error: '트렌드 분석 중 오류가 발생했습니다.', detail: err.message });
  }
});

module.exports = router;
