# CLAUDE.md

Claude Code guidance for the Yiveno monorepo. Prefer **`AGENTS.md`** and **`.cursor/rules/project.mdc`** when they conflict with this file.

## Single source of truth

- **Product + architecture (Chinese):** `docs/product/Yiveno-产品文档-v4.0.md` — read **§0 AI Quick Contract** first; Appendix A is non-normative
- **Cursor / IDE enforcement:** `.cursor/rules/project.mdc`
- **Human + AI ops:** `AGENTS.md`

## Project overview

**Yiveno** is a personal information recall Chrome extension (v4 baseline rebuild in progress): Vue 3 + TypeScript + Cloudflare Workers + Astro marketing site. Monorepo with Bun workspaces.

Current `frontend/src/` baseline:

```
background/  core/  infrastructure/  offscreen/  pages/  styles/
```

Target DDD layers (`presentation/`, `application/`) will be restored during v4 development. See product doc v4.0.

## Root scripts

```bash
# Development
bun run watch                 # extension watch build + backend + website
bun run dev:fe                # extension Vite dev server
bun run dev:be                # backend (port 8787)
bun run dev:web               # website Astro dev (port 3001)

# Build
bun run build:prod            # all workspaces, production profile
bun run build:fe:prod         # extension only

# Quality (after code changes — see project.mdc for full gate)
bun run typecheck:force
bun run lint:check

# Testing
bun run e2e                   # CDP smoke: popup + settings (needs loaded dist/)

# Deploy
bun run deploy:be
```

## Monorepo layout

```
frontend/     # Chrome extension (Vue 3 + Vite) → builds to ./dist/
backend/      # Cloudflare Worker API
website/      # Astro marketing site → builds to ./website/dist/
packages/     # design-tokens, types
scripts/      # cross-workspace tooling (env, e2e, knip)
docs/         # product + ops docs
supabase/     # database migrations
```

## Architecture rules (non-negotiable)

1. **Unidirectional data flow:** Chrome API → Background Script → IndexedDB → Pinia Store → Vue Components; UI actions via `chrome.runtime.sendMessage`.
2. **IndexedDB single entry:** `frontend/src/infrastructure/indexeddb/manager.ts` (`indexedDBManager`).
3. **No direct Chrome API in UI:** `chrome.bookmarks.*` / `chrome.tabs.*` only in `frontend/src/background/`.
4. **DDD direction:** `presentation/ → application/ → core/ → infrastructure/` (layers being rebuilt in v4).
5. **Service Worker:** no `window` / `document` / `localStorage` in background code.
6. **Terminology:** UI uses **Filter (筛选)** and **Recall (找回)**; never **Search** in UI copy.

## Environment variables

Maintain only: `.env.shared.local`, `.env.development.local`, `.env.production.local`.

Do not hand-edit: `.env.runtime/*`, `backend/.dev.vars`, `website/.env`.

```bash
bun run env:sync:dev && bun run env:check:dev
```

See `docs/ENVIRONMENT.md`.

## Load extension locally

1. `bun run watch` or `bun run build:fe:prod`
2. Chrome → Extensions → Load unpacked → repo root `dist/`
