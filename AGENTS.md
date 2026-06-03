# AGENTS.md

为 Codex (Codex.ai/code) 在此仓库中的工作提供指导。

## 唯一真理

- **产品 + 架构文档（中文）：** `docs/product/otterSage-产品文档-v3.0.md`
- Cursor 规则：`.cursor/rules/project.mdc`（不得与此文件冲突）

## 项目概要

**otterSage** — Vue 3 + TypeScript + Cloudflare Workers 构建的智能 Chrome 扩展，提供 AI 书签管理、内容搜索和推荐。DDD 8 层架构。

```
otterSage/
├── frontend/          # Vue 3 Chrome Extension
├── backend/           # Cloudflare Worker API
├── website/           # Nuxt 营销站
└── scripts/           # 构建工具脚本
```

## 关键架构规则（MUST NOT VIOLATE）

### 1. 单向数据流

```
Chrome API → Background Script → IndexedDB → Pinia Store → Vue Components
     ↑                                                           ↓
     └─────────── chrome.runtime.sendMessage ────────────────────┘
```

- ✅ IndexedDB 是唯一事实源
- ✅ Background Script 是唯一 API 监听者（`background/bookmarks.ts`）
- ❌ **禁止**：前端直接调 `chrome.bookmarks.*` 或 `chrome.tabs.*`

### 2. DDD 层边界

```
presentation/ → application/ → core/ → infrastructure/
```

- ❌ `presentation/` 不能直接访问 `infrastructure/`
- ❌ `core/` 不能依赖 `infrastructure/`

### 3. IndexedDB 单入口

- 路径：`frontend/src/infrastructure/indexeddb/manager.ts`
- ✅ 所有 IndexedDB 操作必须通过 `indexedDBManager`
- ❌ **禁止**：直接调 `indexedDB.open()` 或原生 API

### 4. Service Worker 兼容性

Background Script 运行在 Service Worker 环境，**没有** `window` / `document` / `localStorage`。

| 正确 ✅ | 错误 ❌ |
|---|---|
| `setTimeout()` | `window.setTimeout()` |
| `fetch()` | `window.fetch()` |
| `chrome.storage.*` | `localStorage.*` |
| `ReturnType<typeof setTimeout>` | `number`（定时器类型） |

## 存储决策

| 存储 | 生命周期 | 用途 |
|---|---|---|
| IndexedDB | 永久 | 书签数据（2w+）、爬取元数据 |
| `chrome.storage.local` | 永久 | 用户偏好、扩展配置 |
| `chrome.storage.session` | 会话 | 临时数据、UI 状态、同步状态 |
| Pinia Store | 页面级 | 高频 UI 状态、计算属性 |

> 数据量 > 1000 → IndexedDB。需跨页面持久化 → `chrome.storage.local`。仅当前页可用 → Pinia。

## 关键约定

### Filter vs Search

- UI/API/文档：一律用 **Filter（筛选）**
- 实现层（代码、注释）：search/filter 均可
- ❌ **禁止**：UI 文案中出现 "Search"

### TypeScript

- ❌ **禁止**：`any`、`as any`
- ✅ 外部数据必须用 Zod 校验
- ✅ JSDoc 用中文

### Vue 组件

- ✅ 必须用 `defineOptions({ name: 'ComponentName' })`
- ❌ 禁止在组件内调 `chrome.bookmarks.*` 或 `indexedDB.open()`

### 关键库用法

- **Immer**: `updateMap(nodes, draft => { draft.set('123', newNode) })`
- **mitt**: `emitEvent('bookmark:created', {...})`
- **VueUse**: 优先用 `useEventListener` / `useDebounceFn` / `useTimeoutFn`

## 常见错误（FORBIDDEN）

```typescript
// ❌ 前端直接调 Chrome API
await chrome.bookmarks.create({ title: 'New Bookmark' })

// ✅ 通过 Background Script
await chrome.runtime.sendMessage({ type: 'CREATE_BOOKMARK', title: 'New Bookmark' })
```

```typescript
// ❌ 直接改 Map（Vue 检测不到）
nodes.value.set('123', newNode)

// ✅ 用 Immer
updateMap(nodes, draft => { draft.set('123', newNode) })
```

```typescript
// ❌ Service Worker 中用了 window
private timer: number | null = null
this.timer = window.setTimeout(() => {...}, 1000)

// ✅
private timer: ReturnType<typeof setTimeout> | null = null
this.timer = setTimeout(() => {...}, 1000)
```

## 修改代码后必须运行

```bash
bun run typecheck:force  # 类型检查必须通过
bun run eslint           # ESLint 自动修复
bun run stylelint        # Stylelint 自动修复
bun run format           # Prettier 格式化
```

## 交互规范

### 1. 回复风格

- 严格精简 token，不浪费任何多余字符
- 去掉开场白、客套话、道歉、过渡句
- 只输出精炼的工程术语和精确的改动
- 少 token 搞定，就用少 token

### 2. 语言

- 所有回复用中文
