'use strict';

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

let _openai = null;
function getClient() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// Pricing (USD per 1M tokens) — GPT-4o as of 2025
const PRICING = {
  'gpt-4o': { input: 2.50, output: 10.00 },
};

/**
 * Transcribe audio buffer using Whisper API.
 * @param {Buffer} audioBuffer - raw audio bytes
 * @param {string} mimeType - e.g. 'audio/webm'
 * @returns {Promise<string>} transcribed text
 */
async function transcribeAudio(audioBuffer, mimeType) {
  // Write buffer to temp file because openai SDK needs a File-like object
  const ext = mimeType.split('/')[1]?.split(';')[0] || 'webm';
  const tmpPath = path.join('/tmp', `audio_${Date.now()}.${ext}`);
  fs.writeFileSync(tmpPath, audioBuffer);

  try {
    const transcription = await getClient().audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-1',
      language: 'ko',
    });
    return transcription.text;
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

/**
 * Generate a Korean blog post using GPT-4o.
 * @param {string} transcript - voice transcription text
 * @param {Buffer[]} imageBuffers - array of image buffers
 * @param {string} stylePrompt - writing style examples from past posts
 * @param {string} memo - additional short notes
 * @returns {Promise<{content: string, usage: {input_tokens: number, output_tokens: number, cost_usd: number}}>}
 */
async function generateBlogPost(transcript, imageBuffers, stylePrompt, memo) {
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

  // Add images first
  imageBuffers.forEach((buf, i) => {
    const base64 = buf.toString('base64');
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'high' },
    });
  });

  // Add text prompt
  const textParts = [];
  if (transcript) textParts.push(`[음성 내용]\n${transcript}`);
  if (memo) textParts.push(`[추가 메모]\n${memo}`);
  if (imageBuffers.length > 0) textParts.push(`[첨부 사진 ${imageBuffers.length}장 포함]`);
  textParts.push('\n위 내용을 바탕으로 블로그 포스팅을 작성해주세요.');

  userContent.push({ type: 'text', text: textParts.join('\n\n') });

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    max_tokens: 4096,
  });

  const content = response.choices[0].message.content;
  const inputTokens = response.usage.prompt_tokens;
  const outputTokens = response.usage.completion_tokens;
  const pricing = PRICING['gpt-4o'];
  const costUsd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;

  return {
    content,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd },
  };
}

module.exports = { transcribeAudio, generateBlogPost };
