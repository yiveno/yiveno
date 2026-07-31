# AGENTS.md

## 项目

- Yiveno：Vue 3 + TypeScript Chrome 扩展，Backend 为 Cloudflare Workers，Website 为营销站。
- 唯一产品/架构真相：`docs/product/Yiveno-产品文档-v4.0.md`（先读 **§0.1 核心路线** + **§0.1.1 资产/边界/隐患** + §0 其余；附录 A 非规范）
- Cursor 规则：`.cursor/rules/project.mdc`，不得冲突。

## 架构硬规则

- 数据流：Chrome API → Background Script → IndexedDB →（可选 Pinia / 组件状态）→ Vue UI。详见产品文档 §5.1。
- IndexedDB 是书签/Memory 数据本地事实源；所有 IndexedDB 操作必须通过 `frontend/src/infrastructure/indexeddb/manager.ts` 的 `indexedDBManager`。
- **LLM 不碰数据平面执行**：只做理解/意图/表述（及候选重排）；读写作「提议 → 校验 → 确定性代码」。详见产品文档 §0.1.1「LLM 与数据平面边界」与 §0.3。
- Background Script 是唯一 Chrome API 监听者；前端组件禁止直接调 `chrome.bookmarks.*` / `chrome.tabs.*`。
- DDD 依赖方向：`pages|presentation → application → core`；`application` 可依赖 `infrastructure`；UI 经 `background-client` 发消息，不得直连 IndexedDB。细节见产品文档 v4.0。
- Service Worker 环境无 `window` / `document` / `localStorage`；用 `setTimeout`、`fetch`、`chrome.storage.*`、`ReturnType<typeof setTimeout>`。

## 代码约定

- UI/API/文档统一用 **Filter（筛选）**；用户主动作使用 **Recall（找回）**；UI 文案禁止出现 `Search` /「搜索」。
- **图标优先于文案**：工具操作/导航尽量用通识 Material Symbols；省略可见文字时 `title` + `aria-label` 显示完整文案（经 `t()`）。主 CTA、说明、空状态、表单标签除外。
- 扩展用户文案：仅 `_locales/{en,zh_CN}` + `frontend/src/infrastructure/i18n` 的 `t()`；禁止写死 UI 文案与 `|| '兜底'`。`core` 注入 `t` 或返回 message key。官网另选方案，不共用 messages 文件。
- TypeScript 禁止 `any` / `as any`；外部数据用 Zod 校验；**注释与 JSDoc 必须中文**（标识符、API 专有名词可保留英文）。**字符串联合 / `z.enum` 每个字面量须有中文释义**（见 `docs/engineering/业务日志与注释约定.md`）。
- **业务可观测性（硬约定）**：新增或改动业务路径时，必须有**清晰中文注释（意图/边界）** + **关键步骤日志**（开始 / 分支决策 / 成功或失败原因；失败不可静默吞掉）。扩展侧优先用 `frontend/src/infrastructure/logging/flow-log.ts`（`flowStart` / `flowOk` / `flowFail`），scope 稳定可过滤（如 `Msg` / `Capture` / `Recall` / `RecallFlow` / `ClueLlm`）；core 可通过注入 `trace`，禁止 core 直连 Chrome。长文本只打 preview，避免刷屏。细则：`docs/engineering/业务日志与注释约定.md`。
- Vue 组件必须 `defineOptions({ name: 'ComponentName' })`。
- 需要跨层事件时再引入事件总线（当前无 mitt / emitEvent）。
- Map 响应式更新：若引入 Map 状态，优先不可变更新模式（当前 Popup 用组件内状态即可）。
- VueUse 优先：`useEventListener` / `useDebounceFn` / `useTimeoutFn`（引入依赖后再用）。

## 存储决策

- 数据量 > 1000：IndexedDB。
- 跨页面持久化：`chrome.storage.local`。
- 会话临时状态：`chrome.storage.session`。
- 跨页/会话外 UI 状态：Pinia（当前 Popup 可用组件内状态）。

## 验证策略

权威归属与合入门禁见产品文档 **§1.1**（已上线 → 单测 / eval / E2E / 手动；Recall/Capture 变更须先有 `must` case 或 §5 手动步骤）。E2E 仅薄冒烟，不上全量可视化 / 大 Playwright。

### 质量门禁三层职责

| 层级           | 触发时机     | 职责                                                       | 命令                                                                                    |
| -------------- | ------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **pre-commit** | `git commit` | 暂存区快修：ESLint fix + Stylelint + Prettier（含 `.vue`） | `lint-staged`（`max-warnings 0`）                                                       |
| **pre-push**   | `git push`   | 轻量构建 + 分 workspace Knip                               | `build:fe`（frontend/共享包相关变更）；`knip:fe` / `knip:be` / `knip:web`（按变更目录） |
| **CI**         | PR / push    | 权威只读门禁：typecheck、lint、i18n、test、build           | 见下表                                                                                  |

pre-push **不跑** ESLint / typecheck / 全仓 test；`.vue` lint 由 pre-commit 与 CI 覆盖。`knip.json` / 根 `package.json` 变更时 pre-push 跑全仓 `knip`。

### CI 检查矩阵

| 场景                  | TypeScript                             | Lint         | i18n         | Knip                | 前端测试                    | Lighthouse      |
| --------------------- | -------------------------------------- | ------------ | ------------ | ------------------- | --------------------------- | --------------- |
| **PR**                | `typecheck:ci` + build 内 `vue-tsc -b` | `lint:check` | `i18n:check` | `knip`              | `test:run` + backend `test` | 不跑（v4 下线） |
| **push main/develop** | 同上                                   | 同上         | `i18n:check` | `knip`              | `test:run` + backend `test` | 不跑（v4 下线） |
| **每周一**            | —                                      | —            | —            | `knip.yml` 定时复检 | —                           | —               |

### 本地命令

- 日常：`bun run typecheck`（快）、`bun run lint:check`、`bun run i18n:check`、目标单测
- 合并前 / 发布前：`bun run typecheck:force`、`bun run lint:check`、`bun run i18n:check`、`bun run test:run`、`bun run knip`
- Knip 分 workspace：`knip:fe` / `knip:be` / `knip:web`；仅结构项：`knip:fast`；全量报告：`knip:report`
- Knip 版本锁定在根 `devDependencies`；`scripts/knip-runner.mjs` 在 `.cache/knip-runner` 隔离安装（规避 monorepo `zod@3` 与 knip 的 `zod/mini` 冲突）

### AI 默认策略

- 默认只跑与本次改动直接相关的最小验证。
- 禁止每次改动后自动跑全仓 `typecheck:force` / `lint` / `format`，除非用户明确要求或大范围改动。
- Recall / Capture 用户可感变更：合入前补 `recall-eval` **must** 或产品文档 §5 可复现手动步骤（§1.1）。

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
- **git commit message 必须中文**（可用 `feat:` / `fix:` 等 Conventional 前缀，说明正文用中文）。
- **代码注释 / JSDoc 必须中文**（专有名词可保留英文）；**字符串联合 / `z.enum` 每个成员须有中文释义**。
