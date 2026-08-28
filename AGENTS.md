# AGENTS.md

## 项目

- Yiveno：**独立品牌产品**（[`yiveno.com`](https://yiveno.com)），非个人 side project。代码主仓为 GitHub **Organization** [`yiveno/yiveno`](https://github.com/yiveno/yiveno)（私有 monorepo）；Issue/PR 作者显示个人 GitHub 账号属正常，**不以作者判断仓库归属**。
- 技术栈：Vue 3 + TypeScript Chrome 扩展，Backend 为 Cloudflare Workers，Website 为营销站。
- **新会话先读：** `.cursor/rules/session-boot.mdc`（alwaysApply 开机层）· 详版 `docs/product/CURRENT.md`（**只改 CURRENT** → `bun run sync:ide-boot`）
- **术语唯一权威：** `docs/product/Yiveno-术语表.md`（clue、Recall、邻域、附注等；改术语先改此文）。
- **架构决策（勿重议）：** `docs/architecture/decisions/`（ADR）。
- 产品/架构行为契约：`docs/product/Yiveno-产品文档-v4.0.md`（先读 **§0.1 核心路线** + **§0.1.1 资产/边界/隐患**（含「邻域非神谕」）+ §0 其余；附录 A 非规范）
- **视觉/品牌标准（Normative）：** `docs/design/Yiveno-设计标准-v1.md`（完整）；摘要 `DESIGN.md`。权威 `@yiveno/design-tokens/css/brand.css`（色 + Roles + space/radius）；扩展自研 `App*` 控件；图标 Lucide 按需内联。
- Cursor 规则：`.cursor/rules/`（**开机** `session-boot.mdc`）· 索引见 [`.cursor/rules/README.md`](.cursor/rules/README.md)
- **每会话 Task Brief：** [`docs/product/AGENT-TASK-BRIEF.template.md`](docs/product/AGENT-TASK-BRIEF.template.md)
- **PR 合入清单：** `.github/pull_request_template.md`（§1.1 验收归属勾选）。
- **Cursor Hooks：** `.cursor/hooks.json`（拦截破坏性 git）— 见 `.cursor/hooks/README.md`。
- **跨 IDE 薄指针：** 根目录 [`CLAUDE.md`](CLAUDE.md)（Claude Code）· `bun run sync:ide-boot` 同步开机「当下」块
- 对外心智：「那个找东西的」/ 仓库；找回 = 高置信**邻域**，Top1=建议；AI 能力核心不作宣传招牌。
- **文档 ↔ 代码同步（铁律）：** 任何代码改动若与权威文档脱节或有差异，**必须同批更新对应文档**（产品 / 设计 / 工程 / `AGENTS.md`·`project.mdc`）；报完成 = 代码与文档可对照。禁止「先改代码、文档以后再补」。纯重构且契约不变、或 bugfix 且行为已与文档一致，可不改文档。细则见 `.cursor/rules/project.mdc`「文档 ↔ 代码同步」。

### 产品语言（硬规则）

**Yiveno 是彻底的英文产品（美式英语）。** 除开发者向材料外，与中文无关。

- **产品面（仅英文）：** 扩展 UI、官网、隐私/营销、用户可见错误与空态、对外 slogan、用户线索与召回质检用例文案、产品向示例。禁止中文市场、`zh_CN` locale、中文产品文案；禁止把「中文线索 / 中英互译召回」当产品能力或必测项。
- **文案语气：** 站在北美用户习惯；口语、清楚、有温度；禁止官方刻板腔与工程师黑话当主文案（细则见产品文档「市场语言」）。
- **开发者面（中文 OK）：** 与开发者对话回复、git commit message、代码注释 / JSDoc、工程文档备注、业务日志文案。

### 全量用户能力 · 禁止灰名单冒充通解（硬规则）

**用户可感能力默认面向全量用户。** 禁止用硬编码别名表 / 特例词典 / demo·eval 种子词面在程序内做灰度实现，却装作通解（欺骗）。细则与允许/禁止对照见 `.cursor/rules/project.mdc`「全量用户能力」。

- 通解 = 可复用机制（形态、分词、索引契约、产品文档已明示的闭合槽位词表），不是 `js→javascript`、专名 seed、诗人/框架 allowlist。
- 例外仅当产品文档或用户**特殊指定**灰度 / 实验 / 夹具，且标明非通解。
- 残差诚实留给字面 / Hybrid，禁止用「先写几条以后再扩」合理化内容别名主路径。

## 架构硬规则

- 数据流：Chrome API → Background Script → IndexedDB →（可选 Pinia / 组件状态）→ Vue UI。详见产品文档 §5.1。
- IndexedDB 是书签/Memory 数据本地事实源；所有 IndexedDB 操作必须通过 `frontend/src/infrastructure/indexeddb/manager.ts` 的 `indexedDBManager`。
- **LLM 不碰数据平面执行**：只做理解/意图/表述（及候选重排）；读写作「提议 → 校验 → 确定性代码」。详见产品文档 §0.1.1「LLM 与数据平面边界」与 §0.3。
- Background Script 是唯一 Chrome API 监听者；前端组件禁止直接调 `chrome.bookmarks.*` / `chrome.tabs.*`。
- DDD 依赖方向：`pages|presentation → application → core`；`application` 可依赖 `infrastructure`；UI 经 `background-client` 发消息，不得直连 IndexedDB。细节见产品文档 v4.0。
- Service Worker 环境无 `window` / `document` / `localStorage`；用 `setTimeout`、`fetch`、`chrome.storage.*`、`ReturnType<typeof setTimeout>`。

### 权威路径（改功能前先看）

| 主题               | 路径                                                         |
| ------------------ | ------------------------------------------------------------ |
| **当下焦点（源）** | `docs/product/CURRENT.md` → `bun run sync:ide-boot`          |
| **Agent 开机层**   | `.cursor/rules/session-boot.mdc`（alwaysApply · 当下块同步） |
| **架构决策 ADR**   | `docs/architecture/decisions/`                               |
| Recall 主壳        | `frontend/src/pages/sidepanel/`（Chrome Side Panel）         |
| Recall 壳空态文案  | `frontend/src/core/recall/recall-shell-empty-copy.ts`        |
| Action Popup       | **已退役**（原对话主壳；`pages/popup` 已删除）               |
| Memory / clues     | `frontend/src/core/memory/`                                  |
| 消息联合类型       | `frontend/src/core/messaging/background-messages.ts`         |
| Recall 服务        | `frontend/src/application/recall/recall-service.ts`          |

## 代码约定

- UI/API 统一用 **Filter** / **Recall**；用户可见文案禁止 `Search`（对内注释可用 search；中文「筛选/找回」仅开发者沟通）。
- **图标优先于文案**：工具操作/导航尽量用通识 Lucide 图标（内联）；省略可见文字时 `title` + `aria-label` 显示完整文案（经 `t()`）。主 CTA、说明、空状态、表单标签除外。
- 扩展用户文案：仅 `_locales/en` + `frontend/src/infrastructure/i18n` 的 `t()`；禁止写死 UI 文案与 `|| 'fallback'`；禁止新增非 en 产品 locale。`core` 注入 `t` 或返回 message key。官网与扩展分离，产品向文案均为美式英语。
- TypeScript 禁止 `any` / `as any`；外部数据用 Zod 校验；**注释与 JSDoc 必须中文**（标识符、API 专有名词可保留英文）。**字符串联合 / `z.enum` 每个字面量须有中文释义**（见 `docs/engineering/业务日志与注释约定.md`）。
- **业务可观测性（硬约定）**：新增或改动业务路径时，必须有**清晰中文注释（意图/边界）** + **关键步骤日志**（开始 / 分支决策 / 成功或失败原因；失败不可静默吞掉）。扩展侧优先用 `frontend/src/infrastructure/logging/flow-log.ts`（`flowStart` / `flowOk` / `flowFail`），scope 稳定可过滤（如 `Msg` / `Capture` / `Recall` / `RecallFlow` / `ClueLlm`）；core 可通过注入 `trace`，禁止 core 直连 Chrome。长文本只打 preview，避免刷屏。细则：`docs/engineering/业务日志与注释约定.md`。
- Vue 组件必须 `defineOptions({ name: 'ComponentName' })`。
- 需要跨层事件时再引入事件总线（当前无 mitt / emitEvent）。
- Map 响应式更新：若引入 Map 状态，优先不可变更新模式（当前找回主壳用组件内状态即可）。
- VueUse 优先：`useEventListener` / `useDebounceFn` / `useTimeoutFn`（引入依赖后再用）。

## 存储决策

- 数据量 > 1000：IndexedDB。
- 跨页面持久化：`chrome.storage.local`。
- 会话临时状态：`chrome.storage.session`。
- 跨页/会话外 UI 状态：Pinia（当前找回主壳可用组件内状态；P0 关 Side Panel 即丢）。

## 验证策略

权威归属与合入门禁见产品文档 **§1.1**（已上线 → 单测 / eval / E2E / 手动；Recall/Capture 变更须先有 `must` case 或 §5 手动步骤）。E2E 仅薄冒烟，不上全量可视化 / 大 Playwright。

**AI 改扩展代码：** 单测不够，还须 **Chrome DevTools MCP** 真机实测（build → reload → Side Panel UI 路径）；细则见 `.cursor/rules/project.mdc`「MCP 真机实测」。

**AI 排查问题：** **优先 MCP Chrome 真机**还原真实场景、收集 snapshot/控制台等证据，再读码或改码；细则见 `.cursor/rules/project.mdc`「MCP 排查优先」。

### 质量门禁三层职责

| 层级           | 触发时机     | 职责                                                                                                                         | 命令                                                                                                                                                                                                   |
| -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **pre-commit** | `git commit` | 暂存区快修：ESLint fix + Stylelint + Prettier（含 `.vue`）                                                                   | `lint-staged`（`max-warnings 0`；忽略 `backend/worker-configuration.d.ts`）                                                                                                                            |
| **pre-push**   | `git push`   | 按变更：FE 构建 + **test:run** / BE typecheck+test / **doc:check**（`docs/`·`.cursor/rules/`·`scripts/`）/ 分 workspace Knip | `build:fe` + `cd frontend && bun run test:run`（frontend/共享包）；`typecheck:be` + `bun test`（backend）；`bun run doc:check`（文档/开机层/script）；`knip:fe` / `knip:be` / `knip:web`（按变更目录） |
| **CI**         | PR / push    | 权威只读门禁：typecheck、lint、i18n、test、build                                                                             | 见下表                                                                                                                                                                                                 |

pre-push **不跑** ESLint、全仓 typecheck；FE 变更时跑 **build + test:run**（含 recall-eval must）；`docs/` / `.cursor/rules/` / `scripts/` 变更时跑 **doc:check**（含 `sync:ide-boot --check`）。`.vue` lint 由 pre-commit 与 CI 覆盖。`knip.json` / 根 `package.json` 变更时 pre-push 跑全仓 `knip`。

### CI 检查矩阵

| 场景          | TypeScript                             | Lint         | i18n                       | Knip                | 前端测试                    | Lighthouse      |
| ------------- | -------------------------------------- | ------------ | -------------------------- | ------------------- | --------------------------- | --------------- |
| **PR**        | `typecheck:ci` + build 内 `vue-tsc -b` | `lint:check` | `i18n:check` + `doc:check` | `knip`              | `test:run` + backend `test` | 不跑（v4 下线） |
| **push main** | 同上                                   | 同上         | `i18n:check` + `doc:check` | `knip`              | `test:run` + backend `test` | 不跑（v4 下线） |
| **每周一**    | —                                      | —            | —                          | `knip.yml` 定时复检 | —                           | —               |

### 本地命令

- 日常：`bun run typecheck`（快，含 `packages/*`）、`bun run lint:check`、`bun run i18n:check`、目标单测
- 三端并行：`bun run watch` / `bun run dev`（mprocs）或 `bun run watch:stream`（混流）；扩展重建后需 `chrome://extensions` 刷新
- 合并前 / 发布前：`bun run typecheck:force`、`bun run lint:check`、`bun run i18n:check`、`bun run doc:check`、`bun run test:run`、`bun run knip`
- 品牌视觉发版：改 `docs/design/brand-assets/` → `bun run sync:brand-assets`（见 `docs/design/brand-asset-release-checklist.md`）
- Knip 分 workspace：`knip:fe` / `knip:be` / `knip:web`；仅结构项：`knip:fast`；全量报告：`knip:report`
- Knip 版本写在根 `package.json` → `yiveno.knip`；`scripts/knip-runner.mjs` 在 `.cache/knip-runner` 隔离安装（规避 monorepo `zod@3` 与 knip `zod/mini`）。根目录勿直接 `bunx knip`；待 `bunx knip -D .` 不再报 `./mini` 后再打回根依赖。

### AI 默认策略

- 默认只跑与本次改动直接相关的最小验证。
- 禁止每次改动后自动跑全仓 `typecheck:force` / `lint` / `format`，除非用户明确要求或大范围改动。
- **文档 ↔ 代码同步（铁律）：** 契约/行为相对权威文档有差异时，**同批更新文档**再报完成；细则见 `.cursor/rules/project.mdc`。
- Recall / Capture 用户可感变更：合入前补 `recall-eval` **must** 或产品文档 §5 可复现手动步骤（§1.1）。
- **MCP 真机实测（硬规则）：** 改扩展用户可感代码后，单测/ typecheck 之外**必须**调用 **Chrome DevTools MCP**（`user-chrome-devtools`）做真机验证；`build`（或确认 watch 产物）→ `chrome://extensions` 重新加载 → Side Panel **UI 路径**（`fill`/`click`，禁止 `evaluate_script` 直调 background 消息冒充 UI 测试）；报完成须含 MCP 结论。细则见 `.cursor/rules/project.mdc`「MCP 真机实测」。
- **MCP 排查优先（硬规则）：** 排查 bug/回归/行为问题时，**优先** MCP Chrome 真机按真实 UI 路径复现，用 snapshot、控制台等拿够证据后再推断根因或改代码；细则见 `.cursor/rules/project.mdc`「MCP 排查优先」。
- **MCP · SW Console：** `--autoConnect` 与 `--categoryExtensions` 互斥（与 Chrome 版本无关，≥0.20.3 硬互斥）；SW 日志用 extensions 错误页 + 消息复现；细则见 `.cursor/rules/project.mdc`。
- **目标任务必选 vs 可选（与 `.cursor/rules/project.mdc` 一致）：** 可排优先级，但须先分清相对当前目标哪些必选、哪些可选。**必选**（缺则效果变差 / 不可用）→ 不问意见、按序做完。**可选** → 按**收益/成本**默认决策：收益明显大于成本 → 默认做不问；持平/有争议 → 先问；成本明显更大 → 不做。禁止把必选当可砍项；must 夹具宜少而硬，禁止整库探针默认塞进 must。

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

- 与开发者对话：**全部中文**（属开发者面；产品面仍仅英文，见上「产品语言」）。
- 精简、工程化、少 token；避免客套和重复。
- **git commit message 必须中文**（可用 `feat:` / `fix:` 等 Conventional 前缀，说明正文用中文）。
- **代码注释 / JSDoc 必须中文**（专有名词可保留英文）；**字符串联合 / `z.enum` 每个成员须有中文释义**。
