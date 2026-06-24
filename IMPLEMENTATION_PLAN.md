# auto-blog-gen: 네이버 블로그 자동 포스팅 도구 — 구현 계획

## Context

타이핑 없이 음성과 사진만으로 네이버 블로그 포스팅을 자동 생성·업로드하는 웹 도구.
Render에 호스팅하여 로컬 PC 브라우저에서 접근. 과거 포스팅 파일을 참고해 작성자 고유 말투를 유지.

---

## AI 도구 선택: UI 드롭박스로 양쪽 모두 지원

두 Provider를 모두 구현하고, 프론트엔드 UI의 드롭박스에서 선택 가능하게 함.

| 역할 | OpenAI 모드 | Claude 모드 |
|---|---|---|
| 음성 → 텍스트 | OpenAI Whisper (`whisper-1`) | OpenAI Whisper (`whisper-1`) |
| 사진 분석 + 블로그 생성 | GPT-4o | Claude claude-opus-4-6 |

> **Claude API는 오디오 입력 불가** — 어느 모드를 선택해도 STT는 항상 Whisper

**환경변수 `AI_PROVIDER`** = `"openai"` | `"claude"` (서버 기본값, UI에서 런타임 오버라이드 가능)

---

## 기술 스택

| 계층 | 선택 |
|---|---|
| 런타임 | Node.js 20+ |
| 서버 프레임워크 | Express.js |
| 프론트엔드 | Vanilla HTML/CSS/JS (프레임워크 불필요) |
| STT | OpenAI Whisper API (`whisper-1`) |
| 이미지 분석 + 생성 | GPT-4o 또는 Claude claude-sonnet-4-6 |
| 네이버 블로그 연동 | XML-RPC MetaWeblog API (`xmlrpc` npm) |
| 파일 업로드 미들웨어 | `multer` |
| 환경변수 | `dotenv` |
| 호스팅 | Render (Web Service, free tier) |
| 과거 포스팅 저장 | `/posts/*.md` 파일 (DB 불필요) |

---

## 프로젝트 파일 구조

```
auto-blog-gen/
├── src/
│   ├── index.js                  # Express 서버 진입점
│   ├── routes/
│   │   ├── transcribe.js         # POST /api/transcribe (Whisper)
│   │   ├── generate.js           # POST /api/generate (LLM 블로그 생성)
│   │   └── publish.js            # POST /api/publish (네이버 XML-RPC)
│   ├── services/
│   │   ├── openai.js             # Whisper + GPT-4o 클라이언트
│   │   ├── naver.js              # XML-RPC MetaWeblog 클라이언트
│   │   └── pastPosts.js          # /posts/*.md 파일 읽기 + 스타일 추출
│   └── public/
│       ├── index.html            # 메인 UI
│       ├── style.css
│       └── app.js                # 음성 녹음, 이미지 업로드, API 호출
├── posts/                        # 과거 블로그 포스팅 (*.md 파일로 저장)
│   └── example-post.md
├── .env.example                  # 필요한 환경변수 템플릿
├── package.json
├── render.yaml                   # Render 배포 설정
├── CLAUDE.md
└── README.md
```

---

## UI 화면 구성 (단순)

```
[ auto-blog-gen ]
─────────────────────────────────────────
 🎤 음성 입력    [● 녹음 시작]  [■ 정지]
    → 전사된 텍스트: "오늘 친구랑 성수동 카페 갔는데..."

 🖼️ 사진 첨부   [드래그&드롭 또는 클릭]
    → 첨부된 사진 썸네일 미리보기

 📝 추가 메모   [짧은 텍스트 입력칸]

 [✨ 블로그 포스팅 생성]
─────────────────────────────────────────
 미리보기 영역 (생성된 포스팅)
 [📤 네이버 블로그에 업로드]
```

---

## 핵심 처리 흐름

```
[브라우저]
  1. 음성 녹음 (MediaRecorder API → WebM blob)
  2. 사진 첨부 (File input)
  3. 짧은 메모 입력
  4. "생성" 버튼 클릭

[백엔드 /api/generate]
  ├── Whisper API → 음성 텍스트 변환
  ├── GPT-4o Vision → 사진 분석 (각 사진 설명 생성)
  ├── /posts/*.md 읽기 → 말투/스타일 예시 추출 (최근 3~5개)
  └── LLM 프롬프트:
      "아래 작성자의 과거 포스팅 스타일을 참고하여,
       음성 내용과 사진 분석을 바탕으로 네이버 블로그 포스팅을 작성하라"
      → HTML 형식 블로그 포스팅 반환

[브라우저] 미리보기 표시

[백엔드 /api/publish]
  ├── 사진 → metaWeblog.newMediaObject (네이버에 업로드)
  └── metaWeblog.newPost (제목, 본문 HTML, 태그, 카테고리)
      → 네이버 블로그에 포스팅 완료
```

---

## 필요한 인증 정보 확보 방법

### 1. OpenAI API 키
- https://platform.openai.com/api-keys 에서 발급
- 사용 모델: `whisper-1` (STT), `gpt-4o` (이미지+텍스트)
- 환경변수: `OPENAI_API_KEY`

### 2. (Option B 선택 시) Anthropic API 키
- https://console.anthropic.com/ 에서 발급
- 사용 모델: `claude-sonnet-4-6`
- 환경변수: `ANTHROPIC_API_KEY`

### 3. 네이버 블로그 XML-RPC 설정
1. 네이버 블로그 관리 페이지 접속
2. **메뉴/글/동영상 관리 → 플러그인/연동 관리 → 글쓰기 API 설정**
3. API 연결 비밀번호 발급 (기존 네이버 계정 비밀번호와 다른 별도 비밀번호)
4. XML-RPC URL, 블로그 ID 확인
- 환경변수: `NAVER_BLOG_ID`, `NAVER_API_PASSWORD`, `NAVER_USERNAME`

### 4. Render 배포
- https://render.com 에서 GitHub 저장소 연결
- Web Service 생성 (Node.js 환경)
- 환경변수 대시보드에서 위 키들 입력
- 무료 플랜: 750시간/월, 슬립 모드 있음 (로컬 접근 시 wakeup 딜레이 ~30초)

---

## .env.example

```
# OpenAI (필수 - Whisper STT)
OPENAI_API_KEY=sk-...

# Anthropic (Option B 선택 시)
# ANTHROPIC_API_KEY=sk-ant-...

# 네이버 블로그
NAVER_USERNAME=네이버아이디
NAVER_API_PASSWORD=블로그API전용비밀번호
NAVER_BLOG_ID=블로그아이디

# AI 옵션 선택: "openai" 또는 "claude"
AI_PROVIDER=openai

# 서버 포트
PORT=3000
```

---

## 병렬 에이전트 구현 계획 (모듈별 독립 작업)

각 모듈은 독립적으로 구현 가능하므로 여러 에이전트가 동시에 작업한다.

### Agent 1: 프로젝트 기반 + 서버 진입점
**담당 파일:**
- `package.json` — 의존성 (express, openai, @anthropic-ai/sdk, xmlrpc, multer, dotenv, marked)
- `.env.example` — 전체 환경변수 템플릿
- `src/index.js` — Express 서버 (static 서빙, 라우트 등록, multer 설정, 포트 바인딩)
- `render.yaml` — Render Web Service 배포 설정

**주요 구현:**
```javascript
// src/index.js 핵심 구조
const express = require('express');
const multer = require('multer');
const app = express();
app.use(express.static('src/public'));
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25*1024*1024 } });
// 라우트 등록
app.use('/api', require('./routes/transcribe')(upload));
app.use('/api', require('./routes/generate')(upload));
app.use('/api', require('./routes/publish'));
app.listen(process.env.PORT || 3000);
```

---

### Agent 2: AI 서비스 레이어 (OpenAI + Claude)
**담당 파일:**
- `src/services/openai.js` — Whisper STT + GPT-4o Vision + 블로그 생성
- `src/services/claude.js` — Claude claude-opus-4-6 Vision + 블로그 생성 (스트리밍)
- `src/services/aiRouter.js` — provider 선택 로직 (환경변수 or 요청 파라미터)

**주요 구현:**
```javascript
// src/services/openai.js
async function transcribeAudio(audioBuffer, mimeType) { ... }  // Whisper
async function generateBlogPost(transcript, images, styleExamples, memo) { ... }  // GPT-4o

// src/services/claude.js
// 반환값에 usage 포함: { content, usage: { input_tokens, output_tokens, cost_usd } }
async function generateBlogPost(transcript, images, styleExamples, memo, onChunk) { ... }  // streaming

// src/services/aiRouter.js
function getProvider(req) { return req.body.aiProvider || process.env.AI_PROVIDER || 'openai'; }
```

---

### Agent 3: Naver Blog 서비스 + 과거 포스팅 로더
**담당 파일:**
- `src/services/naver.js` — XML-RPC MetaWeblog 클라이언트
- `src/services/pastPosts.js` — `/posts/*.md` 읽기 + 스타일 프롬프트 생성
- `posts/example-post.md` — 샘플 과거 포스팅 파일

**주요 구현:**
```javascript
// src/services/naver.js
const xmlrpc = require('xmlrpc');
async function uploadImage(buffer, filename) { ... }  // metaWeblog.newMediaObject
async function publishPost(title, content, tags, category) { ... }  // metaWeblog.newPost

// src/services/pastPosts.js
async function loadStyleExamples(maxPosts = 5) { ... }  // 최근 5개 포스팅 로드
function buildStylePrompt(examples) { ... }  // 말투 학습 프롬프트 생성
```

---

### Agent 4: API 라우트
**담당 파일:**
- `src/routes/transcribe.js` — `POST /api/transcribe` (음성 → 텍스트)
- `src/routes/generate.js` — `POST /api/generate` (이미지+텍스트 → 포스팅 생성, SSE 스트리밍)
- `src/routes/publish.js` — `POST /api/publish` (네이버 블로그 업로드)

**주요 구현:**
```javascript
// src/routes/generate.js — SSE 스트리밍 응답
router.post('/generate', upload.array('images', 10), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  const provider = aiRouter.getProvider(req);
  if (provider === 'claude') {
    await claudeService.generateBlogPost(..., chunk => res.write(`data: ${JSON.stringify({text: chunk})}\n\n`));
  } else {
    const result = await openaiService.generateBlogPost(...);
    res.write(`data: ${JSON.stringify({text: result, done: true})}\n\n`);
  }
});
```

---

### Agent 5: 프론트엔드 UI
**담당 파일:**
- `src/public/index.html` — 메인 UI (드롭박스 포함)
- `src/public/style.css` — 깔끔한 다크/라이트 스타일
- `src/public/app.js` — 음성 녹음, 이미지 업로드, API 호출, 스트리밍 표시

**UI 레이아웃:**
```
┌─────────────────────────────────────────┐
│  🤖 AI Provider: [OpenAI ▼]             │
├─────────────────────────────────────────┤
│  🎤 음성 입력  [● 녹음] [■ 정지]        │
│  전사: "오늘 친구랑 성수동 카페..."     │
├─────────────────────────────────────────┤
│  🖼️ 사진 첨부  [드래그&드롭]           │
│  [img1] [img2] [img3]                   │
├─────────────────────────────────────────┤
│  📝 추가 메모 [____________________]    │
│                  [✨ 포스팅 생성]       │
├─────────────────────────────────────────┤
│  미리보기 (실시간 스트리밍)             │
│                  [📤 네이버 업로드]     │
├─────────────────────────────────────────┤
│  💰 사용 토큰: 입력 2,341 / 출력 1,205  │
│     예상 비용: $0.0312 (Claude 기준)    │
└─────────────────────────────────────────┘
```

> 포스팅 생성 완료 시 사용 토큰 수(입력/출력)와 예상 비용을 화면 하단에 표시.

**핵심 JS:**
```javascript
// 스트리밍 수신 (SSE)
const eventSource = new EventSource('/api/generate-stream?' + params);
eventSource.onmessage = e => {
  const { text, done } = JSON.parse(e.data);
  previewEl.innerHTML += marked.parse(text);
  if (done) eventSource.close();
};

// 음성 녹음 (MediaRecorder)
const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
recorder.ondataavailable = e => chunks.push(e.data);
recorder.onstop = () => transcribe(new Blob(chunks));
```

---

## 구현 단계별 TODO (에이전트 병렬 실행 순서)

### Round 1 — 병렬 (서로 독립)
- [ ] **Agent 1**: 프로젝트 기반 (package.json, .env.example, src/index.js, render.yaml)
- [ ] **Agent 2**: AI 서비스 (src/services/openai.js, claude.js, aiRouter.js)
- [ ] **Agent 3**: Naver + 과거포스팅 (src/services/naver.js, pastPosts.js, posts/example-post.md)

### Round 2 — 병렬 (Round 1 완료 후)
- [ ] **Agent 4**: API 라우트 (src/routes/*.js) — Agent 1,2,3 결과물 활용
- [ ] **Agent 5**: 프론트엔드 UI (src/public/*) — 독립적으로 구현 가능

### Round 3 — 순차
- [ ] 통합 테스트 + README.md + CLAUDE.md 업데이트
- [ ] Git commit & push

---

## 주요 npm 패키지

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "openai": "^4.47.0",
    "xmlrpc": "^1.3.2",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.4.5",
    "marked": "^12.0.0"
  }
}
```
(Option B 추가: `"@anthropic-ai/sdk": "^0.24.0"`)

---

## 검증 방법

1. **로컬 실행**: `node src/index.js` → `http://localhost:3000` 접속
2. **음성 테스트**: 브라우저에서 녹음 → 텍스트 변환 확인
3. **이미지 테스트**: 사진 업로드 → GPT-4o 분석 결과 확인
4. **생성 테스트**: 포스팅 미리보기 확인 (말투 일치 여부)
5. **발행 테스트**: 네이버 블로그에 실제 업로드 확인 (초안 상태로 먼저 테스트)
6. **Render 배포 테스트**: `render.yaml` push → 자동 배포 확인
