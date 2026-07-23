# AGENTS.md

## 项目

- Yiveno：Vue 3 + TypeScript Chrome 扩展，Backend 为 Cloudflare Workers，Website 为营销站。
- 唯一产品/架构真相：`docs/product/Yiveno-产品文档-v4.0.md`（先读文首 **§0 AI Quick Contract**；附录 A 非规范）
- Cursor 规则：`.cursor/rules/project.mdc`，不得冲突。

## 架构硬规则

- 数据流：Chrome API → Background Script → IndexedDB →（可选 Pinia / 组件状态）→ Vue UI。详见产品文档 §5.1。
- IndexedDB 是书签/Memory 数据本地事实源；所有 IndexedDB 操作必须通过 `frontend/src/infrastructure/indexeddb/manager.ts` 的 `indexedDBManager`。
- Background Script 是唯一 Chrome API 监听者；前端组件禁止直接调 `chrome.bookmarks.*` / `chrome.tabs.*`。
- DDD 依赖方向：`pages|presentation → application → core`；`application` 可依赖 `infrastructure`；UI 经 `background-client` 发消息，不得直连 IndexedDB。细节见产品文档 v4.0。
- Service Worker 环境无 `window` / `document` / `localStorage`；用 `setTimeout`、`fetch`、`chrome.storage.*`、`ReturnType<typeof setTimeout>`。

## 代码约定

- UI/API/文档统一用 **Filter（筛选）**；用户主动作使用 **Recall（找回）**；UI 文案禁止出现 `Search`。
- TypeScript 禁止 `any` / `as any`；外部数据用 Zod 校验；JSDoc 用中文。
- Vue 组件必须 `defineOptions({ name: 'ComponentName' })`。
- Map 响应式更新用 Immer：`updateMap(nodes, draft => { ... })`。
- 事件用 mitt：`emitEvent(...)`。
- VueUse 优先：`useEventListener` / `useDebounceFn` / `useTimeoutFn`。

## 存储决策

- 数据量 > 1000：IndexedDB。
- 跨页面持久化：`chrome.storage.local`。
- 会话临时状态：`chrome.storage.session`。
- 跨页/会话外 UI 状态：Pinia（当前 Popup 可用组件内状态）。

## 验证策略

### 质量门禁三层职责

| 层级           | 触发时机     | 职责                                                       | 命令                                                                                    |
| -------------- | ------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **pre-commit** | `git commit` | 暂存区快修：ESLint fix + Stylelint + Prettier（含 `.vue`） | `lint-staged`（`max-warnings 0`）                                                       |
| **pre-push**   | `git push`   | 轻量构建 + 分 workspace Knip                               | `build:fe`（frontend/共享包相关变更）；`knip:fe` / `knip:be` / `knip:web`（按变更目录） |
| **CI**         | PR / push    | 权威只读门禁：typecheck、lint、test、build                 | 见下表                                                                                  |

pre-push **不跑** ESLint / typecheck / 全仓 test；`.vue` lint 由 pre-commit 与 CI 覆盖。`knip.json` / 根 `package.json` 变更时 pre-push 跑全仓 `knip`。

### CI 检查矩阵

| 场景                  | TypeScript                             | Lint         | Knip                | 前端测试                    | Lighthouse      |
| --------------------- | -------------------------------------- | ------------ | ------------------- | --------------------------- | --------------- |
| **PR**                | `typecheck:ci` + build 内 `vue-tsc -b` | `lint:check` | `knip`              | `test:run` + backend `test` | 不跑（v4 下线） |
| **push main/develop** | 同上                                   | 同上         | `knip`              | `test:run` + backend `test` | 不跑（v4 下线） |
| **每周一**            | —                                      | —            | `knip.yml` 定时复检 | —                           | —               |

### 本地命令

- 日常：`bun run typecheck`（快）、`bun run lint:check`、目标单测
- 合并前 / 发布前：`bun run typecheck:force`、`bun run lint:check`、`bun run test:run`、`bun run knip`
- Knip 分 workspace：`knip:fe` / `knip:be` / `knip:web`；仅结构项：`knip:fast`；全量报告：`knip:report`
- Knip 版本锁定在根 `devDependencies`；`scripts/knip-runner.mjs` 在 `.cache/knip-runner` 隔离安装（规避 monorepo `zod@3` 与 knip 的 `zod/mini` 冲突）

### AI 默认策略

- 默认只跑与本次改动直接相关的最小验证。
- 禁止每次改动后自动跑全仓 `typecheck:force` / `lint` / `format`，除非用户明确要求或大范围改动。

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
