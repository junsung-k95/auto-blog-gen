'use strict';

const Anthropic = require('@anthropic-ai/sdk');

let _anthropic = null;
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// Pricing (USD per 1M tokens) — Claude claude-opus-4-6 as of 2025
const PRICING = {
  'claude-opus-4-6': { input: 5.00, output: 25.00 },
};

const MODEL = 'claude-opus-4-6';

/**
 * Generate a Korean blog post using Claude claude-opus-4-6 with streaming.
 * @param {string} transcript - voice transcription text
 * @param {Buffer[]} imageBuffers - array of image buffers
 * @param {string} stylePrompt - writing style examples from past posts
 * @param {string} memo - additional short notes
 * @param {function} onChunk - callback called with each text chunk (string)
 * @returns {Promise<{content: string, usage: {input_tokens: number, output_tokens: number, cost_usd: number}}>}
 */
async function generateBlogPost(transcript, imageBuffers, stylePrompt, memo, onChunk) {
  const systemPrompt = `당신은 한국 블로거를 위해 포스팅을 대신 작성해주는 AI 어시스턴트입니다.

아래는 이 블로거가 과거에 작성한 포스팅 예시입니다. 이 사람의 말투, 문체, 글쓰기 스타일을 반드시 따라주세요:

${stylePrompt || '(과거 포스팅 없음 — 자연스러운 한국어 블로그 문체로 작성)'}

작성 지침:
- 네이버 블로그에 바로 올릴 수 있는 HTML 형식으로 작성
- 제목은 <h2> 태그, 소제목은 <h3> 태그 사용
- 문단은 <p> 태그 사용
- 자연스럽고 친근한 한국어 블로그 말투 유지
- 사진이 있을 경우 적절한 위치에 [사진N] 플레이스홀더 삽입 (예: [사진1], [사진2])
- 마지막에 해시태그 포함 (예: #서울카페 #일상 #맛집)
- 응답은 HTML 포스팅만 출력 (설명 불필요)`;

  const userContent = [];

  // Add images
  imageBuffers.forEach((buf) => {
    const base64 = buf.toString('base64');
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
    });
  });

  // Add text
  const textParts = [];
  if (transcript) textParts.push(`[음성 내용]\n${transcript}`);
  if (memo) textParts.push(`[추가 메모]\n${memo}`);
  if (imageBuffers.length > 0) textParts.push(`[첨부 사진 ${imageBuffers.length}장 포함]`);
  textParts.push('\n위 내용을 바탕으로 블로그 포스팅을 작성해주세요.');

  userContent.push({ type: 'text', text: textParts.join('\n\n') });

  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 64000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const chunk = event.delta.text;
      fullContent += chunk;
      if (onChunk) onChunk(chunk);
    }
  }

  const finalMsg = await stream.finalMessage();
  inputTokens = finalMsg.usage.input_tokens;
  outputTokens = finalMsg.usage.output_tokens;

  const pricing = PRICING[MODEL];
  const costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

  return {
    content: fullContent,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd },
  };
}

module.exports = { generateBlogPost };
