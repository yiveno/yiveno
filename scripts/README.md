# Scripts 目录

> 本目录包含 Yiveno 仓库的自动化脚本，分为**门禁脚本**（CI 强制）和**工具脚本**（按需使用）。

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
bun run doc:check:all               # = doc:check + doc:check:consistency
```

**CI：** push / PR 时自动执行。

**扩展方法：** 在 `checks` 数组中追加 `{ id, description, fn }` 对象即可新增校验项。

---

### `knip` → `knip-runner.mjs`

**作用：** 未使用代码检测（死文件、未引用导出、未声明依赖等）。

**特殊说明：** 根 monorepo 通过 `resolutions` 锁定 `zod@3`，与 knip 依赖的 `zod/mini` 不兼容。因此在 `.cache/knip-runner` 内独立安装 knip，不污染根 `node_modules`。

**运行：**

```bash
bun run knip              # 分 workspace
bun run knip:fe           # 仅 frontend
bun run knip:be           # 仅 backend
bun run knip:web          # 仅 website
bun run knip:report       # 全量报告，不 exit 1
```

**CI：** push / PR 时执行（`.github/workflows/ci.yml`）。

**解除隔离条件：** 根目录 `bunx knip -D .` 不再报 `Package subpath './mini' is not defined` 后，可删除本脚本并改回根依赖。

---

## 环境脚本（开发/发布时执行）

### `dev-env.mjs`

**作用：** 将多源 `.env.*` 文件合并同步至子项目运行时配置文件。

**源文件（手动维护）：**

- `.env.shared.local` — 各 workspace 共享密钥
- `.env.development.local` / `.env.production.local` — profile 特定变量

**目标文件（自动生成，勿手动编辑）：**

- `.env.runtime/.env.development` → `frontend/vite` 构建时读取
- `backend/.dev.vars` → Wrangler 本地开发
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
  → frontend/public/images/icon-{16,32,48,128}.png

docs/design/brand-assets/logo/yiveno-primary.svg
  → frontend/public/images/logo-mark.svg
  → website/public/images/logo-mark.svg

docs/design/brand-assets/logo/logo-on-{light,dark}.svg
  → frontend/public/images/logo-mark-mono-{light,dark}.svg
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

## GitHub Actions Workflows（`.github/workflows/`）

### `yiveno-api-keep-alive.yml`

**作用：** 定期 ping Supabase（backend JWT 校验依赖），防止免费计划 7 天无活动自动暂停。

**调度：** 每 12 小时（UTC）+ `workflow_dispatch` 手动触发。

**依赖：**

- `REPO VARIABLES`: `SUPABASE_URL`
- `REPO SECRETS`: `SUPABASE_ANON_KEY`

**注意：** 前端 IndexedDB 为本机存储，与 Supabase 解耦；Supabase 仅用于 backend auth。

---

## 维护约定

| 规则           | 说明                                                                                  |
| -------------- | ------------------------------------------------------------------------------------- |
| **新增脚本**   | 需在 `package.json` scripts 中登记；CI 相关脚本需在 `.github/workflows/ci.yml` 中引用 |
| **生成物脚本** | 如 `dev-env.mjs` 生成的 `.env.*` 文件，自动生成、勿手动编辑                           |
| **研究工具**   | 标注「非 CI / 非生产」，不影响门禁                                                    |
| **删除脚本**   | 需同步清理 `package.json` scripts、`eslint.config.js`、`knip.json` 中的残留引用       |
