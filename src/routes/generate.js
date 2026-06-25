'use strict';

const express = require('express');
const { getProvider } = require('../services/aiRouter');
const openaiService = require('../services/openai');
const claudeService = require('../services/claude');
const { loadStyleExamples, buildStylePrompt } = require('../services/pastPosts');
const { disclosureHtml, resolveDisclosure } = require('../services/disclosure');

const LENGTH_PRESETS = {
  info:    { label: '정보형',     targetChars: 1500, instruction: '정보 전달이 중심인 1500자 내외로 작성. 소제목 3개 이상, 각 섹션 200~400자.' },
  review:  { label: '후기형',     targetChars: 800,  instruction: '후기·일상 톤으로 800자 내외, 친근체. 사진을 중심에 두고 짧은 단락으로 구성.' },
  catalog: { label: '카탈로그형', targetChars: 2000, instruction: '제품·장소 비교 카탈로그형 2000자 내외, 항목별 H3 소제목과 장단점 정리.' },
};

function buildContextPrompt({ seedKeyword, secondaryKeywords, lengthPreset, disclosureKind, hasCoupang }) {
  const parts = [];
  if (seedKeyword) parts.push(`주 타겟 키워드: "${seedKeyword}" — 제목과 본문 첫 문단·H2 헤더에 자연스럽게 1~3% 밀도로 포함.`);
  if (Array.isArray(secondaryKeywords) && secondaryKeywords.length) {
    parts.push(`보조 키워드: ${secondaryKeywords.join(', ')} — 본문에 1회 이상씩 자연스럽게 언급.`);
  }
  const preset = LENGTH_PRESETS[lengthPreset];
  if (preset) parts.push(`글 길이/포맷: ${preset.instruction}`);

  const effective = resolveDisclosure(disclosureKind, hasCoupang);
  if (effective === 'coupang_affiliate') {
    parts.push('본문 끝에는 쿠팡파트너스 활동 안내 문구를 단락으로 포함하세요 ("이 포스팅은 쿠팡파트너스 활동의 일환으로...").');
  } else if (effective === 'sponsored') {
    parts.push('본문 상단에 유료 광고/협찬 공시 문구를 포함하세요 ("본 포스팅은 ○○으로부터 제품을 제공받아 작성되었습니다...").');
  } else if (effective === 'self_purchase') {
    parts.push('본문 어딘가에 내돈내산 표기를 자연스럽게 포함하세요.');
  }

  parts.push('네이버 블로그 SEO 모범 사례: H2/H3 소제목 3개 이상, 짧은 단락, 사진 자리 [사진N] 플레이스홀더 활용, 본문 마지막에 해시태그 5~10개.');
  return parts.join('\n- ');
}

module.exports = function (upload) {
  const router = express.Router();

  router.post('/generate', upload.array('images', 10), async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
      const provider = getProvider(req);
      const transcript = req.body.transcript || '';
      const memo = req.body.memo || '';
      const seedKeyword = req.body.seedKeyword || '';
      const secondaryKeywords = req.body.secondaryKeywords
        ? String(req.body.secondaryKeywords).split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const lengthPreset = req.body.lengthPreset || 'review';
      const disclosureKind = req.body.disclosureKind || 'none';
      const hasCoupang = req.body.hasCoupang === 'true' || req.body.hasCoupang === true;
      const imageBuffers = (req.files || []).map(f => f.buffer);

      const examples = await loadStyleExamples(5);
      const stylePrompt = buildStylePrompt(examples);

      // Compose enriched memo so the existing service signatures don't change
      const contextBlock = buildContextPrompt({
        seedKeyword, secondaryKeywords, lengthPreset, disclosureKind, hasCoupang,
      });
      const enrichedMemo = [memo, '─── 작성 가이드 ───', '- ' + contextBlock]
        .filter(Boolean).join('\n\n');

      let result;
      if (provider === 'claude') {
        result = await claudeService.generateBlogPost(
          transcript, imageBuffers, stylePrompt, enrichedMemo,
          (chunk) => sendEvent({ chunk })
        );
      } else {
        result = await openaiService.generateBlogPost(
          transcript, imageBuffers, stylePrompt, enrichedMemo
        );
        sendEvent({ chunk: result.content });
      }

      // Inject disclosure if it wasn't naturally included
      const effective = resolveDisclosure(disclosureKind, hasCoupang);
      if (effective !== 'none') {
        const probe = {
          self_purchase: '내돈내산',
          sponsored: '유료 광고',
          coupang_affiliate: '쿠팡파트너스',
        }[effective];
        if (probe && !result.content.includes(probe)) {
          const block = disclosureHtml(effective);
          sendEvent({ chunk: '\n\n' + block });
          result.content += '\n\n' + block;
        }
      }

      sendEvent({ done: true, usage: result.usage, provider, disclosure: effective });
      res.end();
    } catch (err) {
      console.error('generate error:', err.message);
      sendEvent({ error: err.message });
      res.end();
    }
  });

  return router;
};
