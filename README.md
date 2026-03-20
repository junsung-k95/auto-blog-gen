# auto-blog-gen

음성과 사진으로 네이버 블로그 포스팅을 자동 생성·업로드하는 웹 도구.

## 주요 기능

- **음성 입력** → OpenAI Whisper로 텍스트 변환
- **사진 분석** → GPT-4o 또는 Claude claude-opus-4-6이 사진을 이해하고 포스팅에 활용
- **말투 학습** → `/posts/*.md` 과거 포스팅을 참고해 작성자 스타일 유지
- **실시간 스트리밍** → 포스팅이 생성되는 모습을 실시간으로 확인
- **AI 모델 선택** → UI 드롭박스에서 OpenAI / Claude 전환 가능
- **토큰 비용 표시** → 생성 후 사용 토큰과 예상 비용 표시
- **자동 업로드** → 네이버 블로그 XML-RPC API로 바로 발행

## 빠른 시작

### 1. 환경변수 설정

```bash
cp .env.example .env
# .env 파일에 API 키 입력
```

필요한 키:
- `OPENAI_API_KEY` — https://platform.openai.com/api-keys
- `ANTHROPIC_API_KEY` — https://console.anthropic.com (Claude 사용 시)
- `NAVER_USERNAME`, `NAVER_API_PASSWORD`, `NAVER_BLOG_ID` — 네이버 블로그 관리 > 글쓰기 API 설정

### 2. 설치 및 실행

```bash
npm install
npm start
# → http://localhost:3000 접속
```

### 3. 과거 포스팅 추가

`/posts/` 폴더에 `.md` 파일로 과거 포스팅을 저장하면 말투 학습에 사용됩니다.

## 네이버 블로그 API 설정

1. 네이버 블로그 관리 페이지 접속
2. **메뉴/글/동영상 관리 → 플러그인/연동 관리 → 글쓰기 API 설정**
3. API 연결 비밀번호 발급 → `.env`의 `NAVER_API_PASSWORD`에 입력

## Render 배포

1. GitHub 저장소를 Render에 연결
2. Web Service 생성 (자동으로 `render.yaml` 설정 적용)
3. Render 대시보드에서 환경변수 입력

## 기술 스택

| 역할 | 도구 |
|---|---|
| 서버 | Node.js + Express |
| STT | OpenAI Whisper (`whisper-1`) |
| 이미지 분석 + 생성 | GPT-4o / Claude claude-opus-4-6 |
| 네이버 연동 | XML-RPC MetaWeblog API |
| 호스팅 | Render |

## 구현 계획

자세한 구현 계획은 [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)를 참고하세요.
