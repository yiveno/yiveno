# Scripts 目录

> 本目录包含 Yiveno 仓库的自动化脚本，分为**门禁脚本**（CI / git hook 强制）和**工具脚本**（按需使用）。

---

## 总览

| 脚本                             | 触发                                         | 类别                                           |
| -------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| `check-doc-drift.mjs`            | `doc:check`                                  | CI 门禁                                        |
| `check-doc-code-consistency.mjs` | `doc:check:consistency`                      | CI 门禁                                        |
| `sync-diagrams.mjs`              | `docs:sync-diagrams` / `docs:check-diagrams` | CI（经 `doc:check:all`） / Agent 工具          |
| `diagram-change-impact.mjs`      | `docs:diagram-impact`                        | Agent 工具（**不**改图、**不**进 CI 失败门禁） |
| `check-commit-message.mjs`       | `.husky/commit-msg`                          | git 门禁                                       |
| （根 `bunx knip`）               | `knip*`                                      | CI 门禁                                        |
| `dev-env.mjs`                    | `env:sync*` / `env:check*`                   | 工具                                           |
| `sync-ide-boot.mjs`              | `sync:ide-boot`                              | 工具                                           |
| `sync-brand-assets.mjs`          | `sync:brand-assets`                          | 工具                                           |
| `setup-git-lfs.sh`               | `setup:git-lfs`                              | 工具                                           |
| `tte-summarize-telemetry.mjs`    | `tte:summarize`                              | 研究工具                                       |
| `dev-green-check.mjs`            | `dev:check`                                  | 本地绿检                                       |

---

## 门禁脚本（CI 自动执行）

### `doc:check` → `check-doc-drift.mjs`

**作用：** 防止 message type 在 registry / handler / schema / 产品文档 §4 之间漂移。

**校验项：**

- `background-message-types.registry` 中的 type ↔ `message-handler.ts` 中的 case 完整对应
- `message-handler.ts` 中的 type 在 `core/messaging/*.ts` 中有 Zod schema 定义
- 产品文档 §4 核心 type 已在 registry 中登记
- `CURRENT.md` 存在且包含「最后更新：YYYY-MM-DD」

**运行：**

```bash
bun run doc:check                    # 写入（如有漂移则先同步）
bun run doc:check --check            # 仅校验，漂移则 exit 1
```

**CI：** push / PR 时自动执行（`.github/workflows/ci.yml`）。

---

### `doc:check:consistency` → `check-doc-code-consistency.mjs`

**作用：** 验证代码实现与权威文档中的关键架构承诺一致。

**校验项（C1–C6）：**

| ID  | 校验内容                                                                  | 对应规范 |
| --- | ------------------------------------------------------------------------- | -------- |
| C1  | `core/` 中无 `chrome.*` / `indexedDB.*` 直接调用                          | ADR-004  |
| C2  | `indexedDB.open` 仅在 `infrastructure/indexeddb/manager.ts`               | ADR-004  |
| C3  | Omnibox listener 调用 `recallWithClue` 时必须带 `entry: 'omnibox'`        | ADR-007  |
| C4  | Manifest 无 `default_popup`，`side_panel.default_path = "sidepanel.html"` | ADR-001  |
| C5  | 闭集产品槽位词典存在（`RECALL_OBJECT_TYPE_LEXICON` 等）                   | ADR-005  |
| C6  | 翻牌句 `_Why should things just be things?_` 未在产品代码中实现           | ADR-012  |

**运行：**

```bash
bun run doc:check:consistency
bun run doc:check:all               # = doc:check + doc:check:consistency + docs:check-diagrams
```

**CI：** push / PR 时自动执行。

**扩展方法：** 在 `checks` 数组中追加 `{ id, description, fn }` 对象即可新增校验项。

---

### `docs:sync-diagrams` / `docs:check-diagrams` → `sync-diagrams.mjs`

**作用：** Mermaid 业务逻辑图清单门禁 + 生成 Cursor Agent 同步 Brief（**不**调用外部 LLM API）。

**校验项：**

- `docs/diagrams/registry.json` ↔ 宿主 MD 内 `<!-- diagram: id=… -->` 锚点一一对应
- kind / status 合法且与锚点一致；关联 `codePaths` / `docPaths` 存在
- 已登记宿主上每个 ````mermaid` fence 必须有锚点；结构语法粗检（图类型首行等）

**运行：**

```bash
bun run docs:sync-diagrams              # 校验 + 写 docs/diagrams/.cache/SYNC-BRIEF.md
bun run docs:sync-diagrams --id <id>    # 单图
bun run docs:check-diagrams             # 仅门禁（CI / doc:check:all）
```

**规范：** `docs/engineering/Yiveno-Mermaid图表规范.md` · `docs/diagrams/README.md`

---

### `docs:diagram-impact` → `diagram-change-impact.mjs`

**作用：** 把 Git base↔工作区（或显式 `--paths`）的文件变更映射到 `registry.json` 的 `codePaths` / `doc` / `docPaths`，输出建议复核的图 id。供 Cursor Agent 做语义复核入口。

**不做：** 不改 Mermaid；不判定语义对错；不改变 `docs:check-diagrams`；无外部网络。

**口径：** 命中 ≠ 过时；未命中 ≠ 无影响（无 import 依赖图，间接依赖不作确定性结论）。

```bash
bun run docs:diagram-impact --base HEAD
bun run docs:diagram-impact --base origin/main --write-brief
bun run docs:diagram-impact --paths extension/src/background/listeners/omnibox.ts
bun run docs:diagram-impact --paths A:new.ts D:old.ts M:changed.ts --json
bun run docs:diagram-impact --base HEAD --id runtime.omnibox-offline-recall
```

**输出：** stdout Markdown（或 `--json`）；可选 `--write-brief` → `docs/diagrams/.cache/DIAGRAM-CHANGE-IMPACT.md`（gitignore）。

**报告：** `docs/diagrams/reports/2026-10-图表变更感知机制.md`

---

### `knip`（根 `devDependencies`）

**作用：** 未使用代码检测（死文件、未引用导出、未声明依赖等）。

**说明：** zod 4 起与 knip `zod/mini` 兼容，直接 `bunx knip -D .`（历史隔离脚本 `knip-runner.mjs` 已删除）。

**运行：**

```bash
bun run knip              # 分 workspace
bun run knip:extension           # 仅 extension
bun run knip:worker           # 仅 worker
bun run knip:web          # 仅 website
bun run knip:report       # 全量报告，不 exit 1
```

**CI：** push / PR 时执行（`.github/workflows/ci.yml`）。

---

## 环境脚本（开发/发布时执行）

### `dev-env.mjs`

**作用：** 将多源 `.env.*` 文件合并同步至子项目运行时配置文件。

**源文件（手动维护）：**

- `.env.shared.local` — 各 workspace 共享密钥
- `.env.development.local` / `.env.production.local` — profile 特定变量

**目标文件（自动生成，勿手动编辑）：**

- `.env.runtime/.env.development` → `extension/vite` 构建时读取
- `worker/.dev.vars` → Wrangler 本地开发
- `website/.env` → Astro 构建

**运行：**

```bash
bun run env:sync:dev        # 同步 development 环境
bun run env:sync:prod      # 同步 production 环境
bun run env:check:dev      # 仅校验 development
bun run env:check:prod     # 仅校验 production
bun run watch              # = env:sync:dev + 启动 mprocs
```

**详细说明：** 见 `docs/ENVIRONMENT.md`。

---

### `sync-ide-boot.mjs`

**作用：** 将 `docs/product/CURRENT.md` 的「当下」块同步至 `.cursor/rules/session-boot.mdc`。

**背景：** `CURRENT.md` 是当下焦点的唯一手写源；`session-boot.mdc` 是 Cursor 每会话自动注入的「当下事实」。本脚本消除两处手双写。

**运行：**

```bash
bun run sync:ide-boot         # 同步（如有差异则写入）
bun run sync:ide-boot --check  # 仅校验，不同步
```

**触发：** 每次修改 `CURRENT.md` 后手动执行；`doc:check` 中的 `--check` 模式用于 CI 漂移检测。

---

### `sync-brand-assets.mjs`

**作用：** 将 `docs/design/brand-assets/` 中的母本资源同步至扩展/官网运行时目录。

**母本 → 运行时映射：**

```
docs/design/brand-assets/chrome-extension/icon-{16,32,48,128}.png
  → extension/public/images/icon-{16,32,48,128}.png

docs/design/brand-assets/logo/yiveno-primary.svg
  → extension/public/images/logo-mark.svg
  → website/public/images/logo-mark.svg

docs/design/brand-assets/logo/logo-on-{light,dark}.svg
  → extension/public/images/logo-mark-mono-{light,dark}.svg
  → website/public/images/logo-mark-on-dark.svg

docs/design/brand-assets/applications/yiveno-product-hero.jpg
  → website/public/og-image.jpg
```

**运行：**

```bash
bun run sync:brand-assets         # 同步（如有差异则写入）
bun run sync:brand-assets --check # 仅校验，不同步
```

**详细说明：** 见 `docs/design/brand-asset-release-checklist.md`。

---

### `setup-git-lfs.sh`

**作用：** 配置本仓库 Git LFS filter（`filter.lfs.clean` / `smudge`），并拉取已存储的 LFS 对象。

**运行：**

```bash
bun run setup:git-lfs
```

**前置：** `git-lfs` CLI（macOS: `brew install git-lfs`）。

**背景：** 品牌资源（logo、og-image）通过 Git LFS 管理；本地 clone 后需运行本脚本拉取二进制文件（ADR-006）。

---

## 研究工具（非 CI）

### `tte-summarize-telemetry.mjs`

**作用：** 汇总 TTE（Time-to-Evidence）遥测数据，输出研究用表格。

**输入：** `chrome.storage.local` 导出的 JSON 或 JSONL（`{ events: RecallTelemetryEvent[] }`）。

**输出：**

- 按 `taskId` 分组的 TTE-V / TTE-C / max ECS / confirmed / Success@180 表格
- P50 / P90 统计
- Success@180 成功率

**运行：**

```bash
# 方式 1：文件
bun run tte:summarize -- path/to/P001-telemetry-export.json

# 方式 2：管道
cat export.json | bun run tte:summarize
```

**注意：** 本工具为研究用，**非** Beta 宣称或生产监控。详见 `docs/archive/research/`。

---

## 本地绿检（开发自检，非 CI 替代）

### `dev:check` → `dev-green-check.mjs`

**作用：** 改完一轮后的本地快检：`typecheck:extension` → `knip:extension` → `test:must` → `doc:check`。任一步失败即 exit 1。

**注意：** 非 CI / pre-push 全量替代；合入前仍须跑 `test:run` 与 pre-push。

**运行：**

```bash
bun run dev:check
```

---

## Git 门禁脚本（commit 时执行）

### `check-commit-message.mjs` + `.husky/commit-msg`

**作用：** 强制 commit message 双层校验——

1. **第一层（commitlint）**：首行必须为 `<type>(<scope>): <中文>`
2. **第二层（本脚本）**：body 中必须包含 git 已暂存文件的方括号索引（如 `[extension/src/.../foo.ts] 修改:`），一个文件不少

**背景：** AI 自动生成 message 容易遗漏改动文件索引，导致后续 `git log -p -- <path>` 难以定位历史。本门禁确保每次提交都有一份「按文件索引、分门别类」的归档。

**运行：**

```bash
git commit -m "feat(xxx): ..."   # 自动触发，无需手动调用
bun run check:commit-message -- .git/COMMIT_EDITMSG  # 手动调试
```

**CI：** 通过 `.husky/commit-msg` 在本地 commit 时强制执行；pre-push 不重复执行（已 commit 即通过）。

**格式参考：** `.cursor/rules/commit-message.mdc`

---

## GitHub Actions Workflows（`.github/workflows/`）

### `yiveno-api-keep-alive.yml`

**作用：** 定期 ping Supabase（worker JWT 校验依赖），防止免费计划 7 天无活动自动暂停。

**调度：** 每 12 小时（UTC）+ `workflow_dispatch` 手动触发。

**依赖：**

- `REPO VARIABLES`: `SUPABASE_URL`
- `REPO SECRETS`: `SUPABASE_ANON_KEY`

**注意：** 扩展 IndexedDB 为本机存储，与 Supabase 解耦；Supabase 仅用于 worker auth。

---

## 维护约定

| 规则           | 说明                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| **新增脚本**   | 需在 `package.json` scripts 中登记；CI 相关脚本需在 `.github/workflows/ci.yml` 中引用 |
| **生成物脚本** | 如 `dev-env.mjs` 生成的 `.env.*` 文件，自动生成、勿手动编辑                           |
| **研究工具**   | 标注「非 CI / 非生产」，不影响门禁                                                    |
| **删除脚本**   | 需同步清理 `package.json` scripts、`eslint.config.js`、`knip.json` 中的残留引用       |
