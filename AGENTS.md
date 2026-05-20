# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Single source of truth (read first)

- **Authoritative product + architecture spec (Chinese):** `docs/product/AcuityBookmarks-产品文档-v3.0.md` — **only** product document; update it when behavior or architecture changes.
- **Cursor / IDE enforcement:** `.cursor/rules/project.mdc` (and `.kiro/steering/*.md` must not contradict it).

## Project Overview

**AcuityBookmarks** is an intelligent Chrome extension built with Vue 3, TypeScript, and Cloudflare Workers that provides AI-powered bookmark organization, content-aware search, and smart recommendations. The project follows a sophisticated Domain-Driven Design (DDD) architecture and is optimized for high performance with features like virtual scrolling, IndexedDB caching, and background crawling.

## Available Scripts

### Root Level Commands (Monorepo)

```bash
# Development
bun run dev:frontend          # Start frontend (Vite - port 5173)
bun run dev:backend           # Start backend (Worker - port 8787)
bun run dev:all               # Start both frontends and backend

# Build
bun run build:frontend        # Build frontend with type checking
bun run build:frontend:fast   # Fast build (skip some checks)
bun run build:all             # Build all workspaces

# Quality (must run after code changes)
bun run typecheck:force       # TypeScript type checking (force rebuild)
bun run lint:fix:enhanced     # Auto-fix ESLint + Stylelint + Prettier
bun run format                # Format all code (Prettier)

# Testing
bun run e2e:management        # E2E tests for management page
bun run audit:lhci            # Lighthouse CI performance audit

# Deployment
bun run deploy:backend        # Deploy backend to Cloudflare
```

### Frontend Commands

```bash
cd frontend
bun run dev                   # Development server
bun run build                 # Production build with type checking
bun run build:hot             # Hot reload build (auto-rebundle)
bun run type-check            # TypeScript type checking only
```

### Backend Commands

```bash
cd backend
bun run dev                   # Start Wrangler dev server
bun run deploy                # Deploy to Cloudflare Worker
bun run health-check          # Local health check (HTTPS)
```

## Architecture Overview

### Monorepo Structure

```
acuityBookmarks/
├── frontend/              # Vue 3 Chrome Extension
├── backend/               # Cloudflare Worker API
├── website/               # Marketing website (Nuxt)
└── scripts/               # Build & utility scripts
```

### Frontend Architecture (DDD 8-Layer System)

**Layer 1: Presentation Layer** (`frontend/src/presentation/`)

- UI adapters and presentation-specific composables
- Bridges UI components with application services

**Layer 2: Application Layer** (`frontend/src/application/`)

- Business process orchestration (auth, bookmarks, fonts, notifications, queries, scheduler, settings)
- Coordinates between core and infrastructure layers

**Layer 3: Core Layer** (`frontend/src/core/`)

- Domain models and business rules (pure TypeScript)
- Independent of external implementations
- Contains domain services (diff-engine, executor, query-engine)

**Layer 4: Infrastructure Layer** (`frontend/src/infrastructure/`)

- Technical implementations (IndexedDB, HTTP, logging, events)
- Chrome API wrappers and storage management

**Layer 5: Services Layer** (`frontend/src/services/`)

- Background Script and Worker-specific services
- Legacy services being migrated to application layer

**Layer 6: Stores Layer** (`frontend/src/stores/`)

- Pinia state management for UI state and lightweight caching

**Layer 7: Composables Layer** (`frontend/src/composables/`)

- Global Vue 3 composables (keyboard shortcuts, search, performance)

**Layer 8: Background Layer** (`frontend/src/background/`)

- Chrome Extension Background Script (Service Worker)
- Chrome API event listeners and data synchronization

## Critical Architecture Rules

### 1. Unidirectional Data Flow (MUST NOT VIOLATE)

```
Chrome API → Background Script → IndexedDB → Pinia Store → Vue Components
     ↑                                                           ↓
     └─────────────── chrome.runtime.sendMessage ────────────────┘
```

**Strict Rules:**

- ✅ IndexedDB is the single source of truth
- ✅ Background Script is the only listener (`background/bookmarks.ts`)
- ✅ Frontend MUST NOT directly access Chrome APIs
- ❌ FORBIDDEN: Frontend direct calls to `chrome.bookmarks.*`

### 2. DDD Layer Boundaries (Strict Enforcement)

```
presentation/ → application/ → core/ → infrastructure/
```

- ❌ `presentation/` cannot directly access `infrastructure/`
- ❌ `core/` cannot depend on `infrastructure/`

### 3. IndexedDB Manager (Single Entry Point)

- Path: `frontend/src/infrastructure/indexeddb/manager.ts`
- ✅ All IndexedDB operations MUST go through `indexedDBManager` instance
- ❌ FORBIDDEN: Direct use of `indexedDB.open()` or native APIs

### 4. Service Worker Compatibility (CRITICAL)

**Background Scripts run in Service Worker environment without `window`, `document`, `localStorage`!**

| Correct ✅                      | Incorrect ❌          |
| ------------------------------- | --------------------- |
| `setTimeout()`                  | `window.setTimeout()` |
| `fetch()`                       | `window.fetch()`      |
| `chrome.storage.*`              | `localStorage.*`      |
| `ReturnType<typeof setTimeout>` | `number` (timer type) |

## Storage Responsibility Matrix

| Storage Type           | Lifecycle  | Use Cases                                    |
| ---------------------- | ---------- | -------------------------------------------- |
| IndexedDB              | Permanent  | Bookmark data (20k+), crawled metadata       |
| chrome.storage.local   | Permanent  | User preferences, extension config           |
| chrome.storage.session | Session    | Temporary data, UI state, sync status        |
| Pinia Store            | Page-level | High-frequency UI state, computed properties |

**Decision Tree:**

1. Data volume > 1000 items? → IndexedDB
2. Need persistence after browser close? → chrome.storage.local
3. Need cross-page sharing but session-bound? → chrome.storage.session
4. Current page only, can rebuild on refresh? → Pinia Store

## Technology Stack

### Frontend (Chrome Extension)

- **Framework**: Vue 3.5.18 with Composition API + `<script setup>`
- **Language**: TypeScript 5.8.3 (strict mode + Project References)
- **State Management**: Pinia 3.0.3
- **Build Tool**: Vite 8.0.0 (fast HMR + Rolldown bundling with Rust)
- **Search**: Fuse.js 6.6.2 (fuzzy search)
- **Virtual Scroll**: @tanstack/vue-virtual 3.13.12 (large dataset optimization)
- **Chrome API**: Manifest V3

### Backend (API Server)

- **Runtime**: Cloudflare Worker (global edge computing)
- **Language**: JavaScript (ESM) ES2022 (Bun-optimized)
- **Validation**: Zod 3.22.4 (type-safe data validation)
- **UUID**: uuid 11.1.0
- **Database**: Supabase (PostgreSQL + real-time)
- **AI**: User-provided API Keys (OpenAI / Codex / Gemini) or Chrome Built-in AI (future)

## Key Development Workflows

### Embedding Service (Automatic Behavior)

**Local ONNX Embeddings are fully automatic with smart defaults:**

- ✅ **No user configuration needed** - All settings removed from UI
- ✅ **Automatic quota management** - Adjusts based on bookmark count
- ✅ **Background processing** - Runs during idle time without blocking UI
- ✅ **Incremental sync** - Only processes new/changed bookmarks
- ✅ **Fully local** - No network requests, complete privacy

**Implementation:**

- Service: `frontend/src/infrastructure/embedding/embedding-service.ts`
- Provider: `frontend/src/infrastructure/embedding/onnx-embedding-provider.ts`
- Storage: `frontend/src/infrastructure/embedding/local-vector-store.ts`

**Smart Defaults (hardcoded):**

```typescript
const BATCH_SIZE = 32 // Process 32 bookmarks per batch
const MAX_TEXT_LENGTH = 512 // Truncate text to 512 chars
// Daily quota and other limits are automatically calculated based on bookmark count
```

### Local Development

1. **Install dependencies**: `bun install`
2. **Start all services**: `bun run watch` (frontend build + backend + website)
3. **Load extension**: Chrome → Extensions → Load unpacked → `dist/`

### Code Quality Assurance (MANDATORY)

**After any code changes, MUST run:**

```bash
bun run typecheck:force
bun run lint:fix:enhanced
bun run format
```

- ✅ If errors exist, must fix immediately
- ✅ Only complete after confirming no errors

### Building for Production

1. **Production build**: `bun run build:all`
2. **Clean dist**: Automatically runs `bun scripts/clean-dist.cjs`
3. **Package extension**: Zip `dist/` directory for Chrome Web Store

## Performance Requirements

**Target: Smooth operation with 20k bookmarks**

- ✅ Virtual scrolling: `@tanstack/vue-virtual` for large datasets
- ✅ Batch operations: IndexedDB batching (2000/batch)
- ✅ Cached tree structure: `flattenTreeToMap` to Map (O(1) lookup)
- ❌ FORBIDDEN: Full tree recursive traversal

## Important Conventions

### Terminology: Filter vs Search

**Project uses "Filter" concept consistently:**

- ✅ External (UI, API, docs): **Filter (筛选)**
- ✅ Internal (tech implementation, comments): search/filter both acceptable
- ❌ FORBIDDEN: Using "Search" in UI copy

**Related Components:**

- `BookmarkFilter` component: Bookmark filtering component
- `useBookmarkFilter` Composable: Bookmark filtering hook
- `searchAppService`: Underlying filtering service (technical term保留)

### TypeScript Standards

- ❌ PERMANENTLY FORBIDDEN: `any`, `as any`
- ✅ MUST use Zod for external data validation
- ✅ MUST add JSDoc comments (Chinese)

### Vue Component Standards

- ✅ MUST use `defineOptions({ name: 'ComponentName' })`
- ❌ FORBIDDEN: Direct calls to `chrome.bookmarks.*` in components
- ❌ FORBIDDEN: Direct calls to `indexedDB.open()` in components

### Key Libraries

- **Immer**: `updateMap(nodes, draft => {...})` (immutable state updates)
- **mitt**: `emitEvent('bookmark:created', {...})` (event bus)
- **VueUse**: Prefer `useEventListener`, `useDebounceFn`, `useTimeoutFn`
- **Zod**: All external data must be validated

## Common Errors (FORBIDDEN)

### 1. Data Flow Violation

```typescript
// ❌ FORBIDDEN: Frontend direct Chrome API access
await chrome.bookmarks.create({ title: 'New Bookmark' })

// ✅ CORRECT: Through Background Script
await chrome.runtime.sendMessage({
  type: 'CREATE_BOOKMARK',
  title: 'New Bookmark'
})
```

### 2. State Update Error

```typescript
// ❌ FORBIDDEN: Direct Map modification (Vue can't detect)
nodes.value.set('123', newNode)

// ✅ CORRECT: Use Immer
updateMap(nodes, draft => {
  draft.set('123', newNode)
})
```

### 3. Service Worker Compatibility

```typescript
// ❌ FORBIDDEN
private timer: number | null = null
this.timer = window.setTimeout(() => {...}, 1000)

// ✅ CORRECT
private timer: ReturnType<typeof setTimeout> | null = null
this.timer = setTimeout(() => {...}, 1000)
```

## Integration Points

- **Authentication**: Google, GitHub OAuth + Supabase
- **Payment Processing**: Gumroad integration (Lemon Squeezy removed)
- **AI Services**: User-provided API Keys (OpenAI / Codex / Gemini) + Local ONNX embeddings (fully automatic, no user configuration needed)
- **Storage**: IndexedDB + Chrome Bookmarks API sync

## File Organization

- **Frontend**: Strict DDD 8-layer architecture
- **Backend**: Service Worker with event-driven architecture
- **Naming**: Consistent `useXXXStore` for Pinia stores
- **Import paths**: Aliased paths (`@/`) for clean imports

## Testing Strategy

### E2E Testing

- **Management Page**: Full functional testing with Puppeteer
- **Performance Testing**: CPU throttling + network simulation
- **Chrome Extension Testing**: Extension lifecycle and API interactions

### Quality Metrics

- **Bundle Size**: Optimized with code splitting and tree shaking
- **Performance**: Virtual scrolling for large datasets
- **Memory Usage**: IndexedDB caching reduces API calls
- **User Experience**: Progress indicators and error handling

## Deployment Configuration

### Frontend (Chrome Extension)

- **Build Target**: Optimized for Chrome 100+ browsers
- **Output**: `dist/` directory with manifest.json
- **Deployment**: Chrome Web Store + GitHub Releases

### Backend (Cloudflare Worker)

- **Runtime**: Edge network with global distribution
- **Database**: Supabase (PostgreSQL) with vector search
- **AI**: User-provided API Keys (OpenAI / Codex / Gemini) + Local ONNX embeddings (automatic)
- **Custom Domain**: api.acuitybookmarks.com
