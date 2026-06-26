'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function buildPrompt(transcript, imageBuffers, stylePrompt, memo) {
  const system = `당신은 한국 블로거를 위해 포스팅을 대신 작성해주는 AI 어시스턴트입니다.

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

  const parts = [];
  if (transcript) parts.push(`[음성 내용]\n${transcript}`);
  if (memo) parts.push(`[추가 메모]\n${memo}`);
  if (imageBuffers.length > 0) parts.push(`[첨부 사진 ${imageBuffers.length}장 포함]`);
  parts.push('위 내용을 바탕으로 블로그 포스팅을 작성해주세요.');

  return `${system}\n\n${parts.join('\n\n')}`;
}

/**
 * Generate a Korean blog post using `claude -p` CLI (OAuth subscription, no API key needed).
 * Streams output chunks via onChunk callback.
 */
async function generateBlogPost(transcript, imageBuffers, stylePrompt, memo, onChunk) {
  const prompt = buildPrompt(transcript, imageBuffers, stylePrompt, memo);

  // Save images to temp files for potential future --image flag support
  const tmpImages = [];
  for (let i = 0; i < imageBuffers.length; i++) {
    const p = path.join(os.tmpdir(), `blog_img_${Date.now()}_${i}.jpg`);
    fs.writeFileSync(p, imageBuffers[i]);
    tmpImages.push(p);
  }

  const cleanup = () => tmpImages.forEach(p => { try { fs.unlinkSync(p); } catch {} });

  return new Promise((resolve, reject) => {
    // Pass prompt via stdin to avoid shell injection
    const proc = spawn('claude', ['-p'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    proc.stdin.write(prompt, 'utf8');
    proc.stdin.end();

    let content = '';
    let errBuf = '';

    proc.stdout.on('data', (data) => {
      const chunk = data.toString('utf8');
      content += chunk;
      if (onChunk) onChunk(chunk);
    });

    proc.stderr.on('data', (data) => {
      errBuf += data.toString('utf8');
    });

    proc.on('close', (code) => {
      cleanup();
      if (code !== 0) {
        const hint = errBuf.includes('login') || errBuf.includes('auth')
          ? 'claude login 으로 먼저 로그인하세요.'
          : errBuf || `exit code ${code}`;
        reject(new Error(`Claude CLI 오류: ${hint}`));
        return;
      }
      resolve({
        content,
        // CLI doesn't expose token counts
        usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
      });
    });

    proc.on('error', (err) => {
      cleanup();
      if (err.code === 'ENOENT') {
        reject(new Error('claude 명령어를 찾을 수 없습니다. Claude CLI를 설치 후 claude login 하세요.'));
      } else {
        reject(err);
      }
    });
  });
}

module.exports = { generateBlogPost };
