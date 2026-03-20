# CLAUDE.md

This file provides guidance for AI assistants (Claude and others) working on the `auto-blog-gen` repository.

## Project Overview

`auto-blog-gen` is a Node.js/Express web service for automated Naver blog posting. Users access a simple web UI to record voice, upload photos, and auto-generate + publish blog posts using AI.

## Repository State (as of 2026-03-20)

| Item | Status |
|---|---|
| Source code | Implemented |
| Dependencies | Defined in package.json |
| Tests | Not yet created |
| CI/CD | render.yaml configured |
| Documentation | README.md + IMPLEMENTATION_PLAN.md |

## Current File Structure

```
auto-blog-gen/
├── src/
│   ├── index.js              # Express server entry point
│   ├── routes/
│   │   ├── transcribe.js     # POST /api/transcribe (Whisper STT)
│   │   ├── generate.js       # POST /api/generate (AI blog generation, SSE streaming)
│   │   └── publish.js        # POST /api/publish (Naver Blog XML-RPC)
│   ├── services/
│   │   ├── openai.js         # Whisper + GPT-4o client
│   │   ├── claude.js         # Claude claude-opus-4-6 client (streaming)
│   │   ├── aiRouter.js       # Provider selection (openai vs claude)
│   │   ├── naver.js          # XML-RPC MetaWeblog client
│   │   └── pastPosts.js      # /posts/*.md reader for style reference
│   └── public/
│       ├── index.html        # Main UI
│       ├── style.css
│       └── app.js            # Voice recording, image upload, SSE streaming
├── posts/                    # Past blog posts for style reference (*.md)
│   └── example-post.md
├── .env.example              # All required env vars documented
├── package.json
├── render.yaml               # Render deployment config
├── IMPLEMENTATION_PLAN.md    # Detailed implementation plan
├── README.md
└── CLAUDE.md                 # This file
```

## Development Setup

```bash
# Install dependencies
npm install

# Run development server (with file watching)
npm run dev

# Run production server
npm start
```

Server runs on `http://localhost:3000` by default.

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (required for Whisper STT) |
| `ANTHROPIC_API_KEY` | Anthropic API key (required for Claude mode) |
| `NAVER_USERNAME` | Naver account ID |
| `NAVER_API_PASSWORD` | Naver Blog API connection password |
| `NAVER_BLOG_ID` | Naver Blog ID |
| `AI_PROVIDER` | Default AI provider: `openai` or `claude` |
| `PORT` | Server port (default: 3000) |

## Technology Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express.js |
| Frontend | Vanilla HTML/CSS/JS |
| STT | OpenAI Whisper (`whisper-1`) |
| Image analysis + Blog generation | GPT-4o or Claude claude-opus-4-6 |
| Naver Blog | XML-RPC MetaWeblog API (`xmlrpc` npm) |
| File upload | multer (memory storage) |
| Hosting | Render |
| Past posts storage | `/posts/*.md` files |

## Key Notes for AI Assistants

1. **Past posts** go in `/posts/` as `.md` files — used for writing style reference.
2. **AI provider** is selectable at runtime via UI dropdown or `AI_PROVIDER` env var.
3. **Naver API password** is separate from the Naver account login password — get it from blog admin.
4. **Streaming** is implemented via SSE (Server-Sent Events) in `/api/generate`.
5. **Never commit** `.env`, `node_modules/`, or other gitignored artifacts.

## Git Workflow

- **Feature branches:** `claude/<description>-<sessionId>`
- Always push with `-u`: `git push -u origin <branch-name>`
