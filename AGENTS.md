# AGENTS.md

## 项目

- otterSage：Vue 3 + TypeScript Chrome 扩展，Backend 为 Cloudflare Workers，Website 为营销站。
- 唯一产品/架构真相：`docs/product/otterSage-产品文档-v3.0.md`
- Cursor 规则：`.cursor/rules/project.mdc`，不得冲突。

## 架构硬规则

- 数据流：Chrome API → Background Script → IndexedDB → Pinia Store → Vue Components。
- IndexedDB 是书签数据唯一事实源；所有 IndexedDB 操作必须通过 `frontend/src/infrastructure/indexeddb/manager.ts` 的 `indexedDBManager`。
- Background Script 是唯一 Chrome API 监听者；前端组件禁止直接调 `chrome.bookmarks.*` / `chrome.tabs.*`。
- DDD 依赖方向：`presentation/ → application/ → core/ → infrastructure/`；禁止反向依赖，`presentation/` 不得直连 `infrastructure/`。
- Service Worker 环境无 `window` / `document` / `localStorage`；用 `setTimeout`、`fetch`、`chrome.storage.*`、`ReturnType<typeof setTimeout>`。

## 代码约定

- UI/API/文档统一用 **Filter（筛选）**；UI 文案禁止出现 `Search`。
- TypeScript 禁止 `any` / `as any`；外部数据用 Zod 校验；JSDoc 用中文。
- Vue 组件必须 `defineOptions({ name: 'ComponentName' })`。
- Map 响应式更新用 Immer：`updateMap(nodes, draft => { ... })`。
- 事件用 mitt：`emitEvent(...)`。
- VueUse 优先：`useEventListener` / `useDebounceFn` / `useTimeoutFn`。

## 存储决策

- 数据量 > 1000：IndexedDB。
- 跨页面持久化：`chrome.storage.local`。
- 会话临时状态：`chrome.storage.session`。
- 页面高频 UI 状态：Pinia。

## 验证策略

- 默认只跑与本次改动直接相关的最小验证：目标单测、局部 typecheck、局部 lint。
- 禁止每次改动后自动跑全仓检查。
- 仅用户明确要求、发布前、合并前、或大范围改动时运行：
  - `bun run typecheck:force`
  - `bun run eslint`
  - `bun run stylelint`
  - `bun run format`

## Token / 工具输出预算

- 优先窄范围读取文件；禁止无筛选全仓 `cat` / `sed` / `rg`。
- `rg` 必须带路径或精确模式；大范围搜索需限制输出。
- 长命令输出重定向到 `/tmp`，只 `tail -n 80` 或提取关键错误。
- 工具 `max_output_tokens` 默认 ≤ 12000；除非必要不要超过 30000。
- 不粘贴大文件、大日志、大 diff；用文件路径 + 行号摘要。
- 优先修改已有文件，避免无关格式化导致大 diff。

## 环境变量

- 规则文档：`docs/ENVIRONMENT.md`
- 只维护：`.env.shared.local`、`.env.development.local`、`.env.production.local`。
- 禁止手改生成物：`.env.runtime/*`、`backend/.dev.vars`、`website/.env`。
- 修改环境变量后运行：`bun run env:sync:dev && bun run env:check:dev`。
- 发布前运行：`bun run env:sync:prod && bun run env:check:prod`。

## 回复

- 全部中文。
- 精简、工程化、少 token；避免客套和重复。
