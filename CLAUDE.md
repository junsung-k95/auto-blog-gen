# CLAUDE.md

This file provides guidance for AI assistants (Claude and others) working on the `auto-blog-gen` repository.

## Project Overview

`auto-blog-gen` is a Node.js/JavaScript project for automated blog generation. The repository is in its initial scaffolding state — no application code has been committed yet.

## Repository State (as of 2026-03-20)

| Item | Status |
|---|---|
| Source code | Not yet created |
| Dependencies | Not yet defined |
| Tests | Not yet created |
| CI/CD | Not yet configured |
| Documentation | Minimal placeholder |

## Current File Structure

```
auto-blog-gen/
├── .gitignore     # Standard Node.js gitignore template
├── README.md      # Placeholder header only
└── CLAUDE.md      # This file
```

## Technology Stack

Based on the `.gitignore` template, this project is intended to be a **Node.js/JavaScript** project. The gitignore covers:
- npm, yarn, pnpm package managers
- TypeScript (`.tsbuildinfo`)
- Common frontend frameworks: Next.js, Nuxt.js, Gatsby, SvelteKit, VitePress, Docusaurus
- Bundlers: Parcel, Vite, FuseBox
- Test coverage: istanbul/nyc, lcov

The exact framework and toolchain have not been chosen yet.

## Development Setup

Once the project is initialized, the typical workflow will be:

```bash
# Install dependencies
npm install

# Run development server (command TBD)
npm run dev

# Run tests (command TBD)
npm test

# Build for production (command TBD)
npm run build
```

## Git Workflow

- **Main branch:** `main` (or `master`)
- **Feature branches:** use descriptive names, e.g. `feature/add-openai-integration`
- **Claude branches:** follow the pattern `claude/<description>-<sessionId>`
- Commit messages should be clear and descriptive
- Always push with `-u` to set upstream: `git push -u origin <branch-name>`

## Conventions to Follow

Since no application code exists yet, follow these general Node.js best practices when building this project:

### Code Style
- Use consistent indentation (2 spaces is standard for JS/TS projects)
- Prefer `const` over `let`; avoid `var`
- Use async/await over raw Promise chains
- Keep functions small and single-purpose

### File Organization (recommended)
```
src/
├── index.js        # Entry point
├── generators/     # Blog content generation logic
├── services/       # External API integrations (AI, CMS, etc.)
├── utils/          # Shared utility functions
└── config/         # Configuration loading
tests/
├── unit/
└── integration/
```

### Environment Variables
- Never commit secrets or API keys
- Use `.env` for local development (already gitignored)
- Provide a `.env.example` with all required keys documented (not gitignored)

### Dependencies
- Pin exact versions in production (`npm install --save-exact`)
- Keep `devDependencies` separate from `dependencies`
- Audit dependencies regularly: `npm audit`

## Key Notes for AI Assistants

1. **This project has no existing code** — when implementing features, establish patterns from scratch following the conventions above.
2. **Check README.md** for any updated project description before starting work.
3. **Create `.env.example`** whenever environment variables are introduced.
4. **Add tests** alongside any new source files.
5. **Update this CLAUDE.md** as the project evolves with new structure, commands, and conventions.
6. **Do not commit** `.env`, `node_modules/`, `dist/`, or other gitignored artifacts.
