# DEV 调试 API（Probe Console + Service Worker）

> **权威 UI（最终形态）：** 开发构建打开  
> `chrome-extension://<扩展id>/probe-console.html`  
> **语料 / Console UI：** monorepo 包 `@yiveno/probe`（`packages/yiveno-probe`，见 [ADR-009](../architecture/decisions/ADR-009-yiveno-probe-package.md)）。  
> **挂载壳：** `extension/src/dev/probe-console/`（仅入口 + 扩展样式；**物理隔离**于产品 `pages/`；**不进** `manifest` / CWS `build:prod`）。  
> **Chrome / IDB 桥：** `extension/src/dev/probe/`（seed / purge / snapshot / DEV handler）。  
> **定位：** 测试工作台——**写入测试数据 + 清理**（预设写入 / 按选项批量删）。评审 / 对拍 UI 暂不接 Console。  
> **辅入口：** Service Worker `globalThis.yiveno.*`（MCP / 无 UI 脚本；盘点 / 夹具仍可走消息或 SW）。  
> **非范围：** 生产用户能力、`recall-eval` / `omnibox-eval` CI 夹具（保留 core，勿并进工作台主路径）。  
> **禁止：** 用本工具对外宣称 §5.9 Beta / 种子 TTE 达标。维护者本机即测试场（书签已自备备份）；种库/清空按用户点名执行，不做沙盒式「防污染」护栏。  
> **文案：** Console 用「手写精选 / 半仿真 / 无关干扰 / 随机种子」；勿再对维护者展示 bm、ex、noise/div、filler seed 等缩写。API 字段名可保留英文。  
> **「种子」四义（勿混）：** ① §5.9 **种子用户/验证**（真人真库）≠ ② **种库**（`seedRecallProbe` 写入测试数据）≠ ③ **随机种子**（`fillerSeed`，仅半仿真/干扰）≠ ④ **主题 seed**（禁止灰名单）。权威消歧见术语表 §8.1。  
> **Chrome 布局：** 种库写入**真实主题文件夹**（Research / Dev docs / Later 等）+ 少量书签栏散落；**不再**创建「Yiveno Probe」沙盒夹。`removeProbeFolder` = 删除这些主题夹（兼清历史沙盒夹）。`chromeBookmarkSync: 'curated_only'` 仅为 **~20k 压力性能**（半仿真/干扰直写 Memory），不是防污染。

---

## 0. Probe Console（推荐）

1. `cd extension && bun run build`（`--mode development`；含 `probe-console.html`）
2. `chrome://extensions` → 重新加载 Yiveno
3. **入口（推荐）：** 任意产品页顶栏（Side Panel / Memory / Settings）右侧 **「Test workbench (DEV)」**（包裹盒图标）→ 打开或聚焦 `probe-console.html`  
   **辅：** 地址栏 `chrome-extension://<id>/probe-console.html`（扩展 id 见详情页；SW 启动日志也会打印完整 URL）

| 能力             | 说明                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **写入测试数据** | 选预设 → `DEV_SEED_RECALL_PROBE`；参数可调（含**半仿真/干扰随机种子** `fillerSeed`：本地过程随机、可复现）；本机预设保存 + JSON 导入导出 |
| **清理**         | 一键：清除半仿真与干扰 · 清除全部测试条目 · 清空整库；选项可组合范围 / 类型 / Chrome → `DEV_PROBE_CLEANUP`                               |

盘点（`DEV_PROBE_LIBRARY_SNAPSHOT`）/ 夹具列表（`DEV_LIST_PROBE_FIXTURES`）/ 回溯等仍在 DEV 消息与 SW 辅入口；**不在 Console UI**。

`DEV_PURGE_PROBE_NOISE` 仍可用（等价于清除半仿真与无关干扰 + 移除 Probe 文件夹）。

**隔离约定：** 见 `extension/src/dev/README.md`。挂载壳只许 `src/dev/**`；语料 / Console Vue 落在 `@yiveno/probe`。

---

## 1. 怎么调用（SW 辅入口）

1. `cd extension && bun run build`（或 `build:watch` 已产出最新 `dist/`）
2. `chrome://extensions` → 重新加载 Yiveno
3. 点 **Service Worker**「检查」→ Console
4. 输入下文 API（多数须 `await`）

启动时 SW 会打印 Probe Console URL 与 `yiveno.*` 摘要。

---

## 2. 代码维护入口

| 层级                  | 路径                                                 | 职责                                                                           |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| **语料 / Console UI** | `packages/yiveno-probe`（`@yiveno/probe`）           | 画像语料、预设、配方、邻域 helpers、Probe Console（造数 UI）                   |
| **Chrome / IDB 桥**   | `extension/src/dev/probe/`                           | seed / purge / snapshot / 夹具 DEV 门禁 / SW expose / `DEV_*` handler          |
| **挂载壳**            | `extension/src/dev/probe-console/`                   | `probe-console.html` 入口 + 扩展样式；`open-probe-console-page.ts`（顶栏打开） |
| **消息 schema**       | `extension/src/core/messaging/debug-messages.ts`     | Zod；`DEV_*`（契约面，非语料）                                                 |
| **登记册**            | `docs/engineering/background-message-types.registry` | `bun run doc:check`                                                            |
| **构建隔离**          | `vite/build-options.ts` + `scripts/clean-dist.cjs`   | 仅 development 产出 `probe-console.html`                                       |

### 新增能力清单（维护者）

1. 纯语料 / Console UI → `@yiveno/probe`；Chrome 执行面 → `extension/src/dev/probe/`（**禁止**再写入 `infrastructure/`）
2. 消息：`debug-messages.ts` → `src/dev/probe/debug-dev-handler.ts` → registry → **Probe Console 接线**
3. 可选：仍挂 `yiveno.*`（辅）
4. **更新本文**；产品顶栏允许 **仅 `import.meta.env.DEV`** 的「Test workbench」入口（生产 / CWS 不渲染、不打入 `probe-console.html`）；**禁止**把工作台做成 Settings 常驻区块或生产用户导航

---

## 3. `globalThis.yiveno` API 总表

| API                                          | 类型                | 干什么               | 实现                                                             | 专题文档                                                        |
| -------------------------------------------- | ------------------- | -------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| `yiveno.seedRecallProbe(payload?)`           | `async`             | 种入召回探针语料     | `src/dev/probe/expose-recall-probe-seed-debug.ts` → seed-service | 产品文档 §5.11.1a；[Omnibox-手测步骤](./Omnibox-手测步骤.md) §2 |
| `yiveno.cleanupProbe(payload)`               | `async`             | 按选项批量清理       | 同上 → cleanup-service                                           | 本文 §0                                                         |
| `yiveno.purgeProbeNoise()`                   | `async`             | 清除噪声/多样性层    | 同上 → purge-service                                             | [TTE checklist](./TTE-种子用户研究-checklist.md)                |
| `yiveno.backdateMemorySavedAt(input)`        | `async`             | 回溯保存时刻         | `infrastructure/debug/expose-memory-dev-debug.ts`                | 冷却手测；禁冒充 Beta                                           |
| `yiveno.runProbeOmniboxSmoke()`              | `async`             | Omnibox 11 条冒烟    | `src/dev/probe/recall-probe-omnibox-smoke.ts`                    | Omnibox 手测 §2.1                                               |
| `yiveno.probeOmniboxCopyPaste`               | `readonly string[]` | 地址栏复制块         | 同上                                                             | 同上 §4.1–4.2                                                   |
| `yiveno.listRecallTelemetryEvents()`         | `async`             | TTE + 体验遥测缓冲   | `expose-recall-telemetry-debug.ts`                               | R4-Phase-E；产品文档 §5.9 / §7.0                                |
| `yiveno.summarizeVisibleProgressTelemetry()` | `async`             | 可见进展放弃率等汇总 | 同上（`summarize-visible-progress-telemetry`）                   | §7.0 体验；**禁**冒充 §5.9                                      |
| `yiveno.exportDualThreadAggregateSketch()`   | `async`             | 暗线匿名汇总草图     | `expose-dual-thread-debug.ts`                                    | [暗线基建](./暗线基建-失败归因与受控适应.md)；无 clue/原文      |
| `yiveno.assessKnownGoldRecallGap(input)`     | sync                | 已知金标漏召阶段     | 同上                                                             | 区分未存/候选漏/排序；研究用                                    |
| `yiveno.checkClueGateway(clue)`              | sync                | 噪音网关试跑         | `expose-clue-gateway-debug.ts`                                   | —                                                               |
| `checkClueGateway(clue)`                     | sync                | 同上（历史兼容）     | 同上                                                             | —                                                               |

**门禁：** 上表全部仅 DEV；`vite build --mode production` 不挂载、不产出 Probe Console。

**消息（Console / sendMessage）：** `DEV_SEED_RECALL_PROBE` · `DEV_PROBE_CLEANUP` · `DEV_PURGE_PROBE_NOISE` · `DEV_BACKDATE_MEMORY_SAVED_AT` · `DEV_PROBE_LIBRARY_SNAPSHOT` · `DEV_LIST_PROBE_FIXTURES`

**SW 硬约束：** Service Worker 禁止动态 `import()`。bootstrap 门闩在 `bootstrap-ready.ts`；listeners / DEV handler 须**静态** import（勿再为「破环」写 `await import(...)`）。

---

## 4. API 说明

### 4.1 `yiveno.seedRecallProbe`

**作用：** 写入探针测试库，供 Recall / Omnibox MCP 手测。

**默认（约千条完整测试库）：**

```js
await yiveno.seedRecallProbe({ replace: true })
```

**常用参数：**

| 字段                     | 默认                                   | 说明（Console 文案）                                                  |
| ------------------------ | -------------------------------------- | --------------------------------------------------------------------- |
| `replace`                | `true`                                 | 先清空当前库再写入                                                    |
| `personas`               | `['researcher','creator','developer']` | 手写精选主题包；可加 `'student'` / `'knowledge_worker'`（须显式传入） |
| `diversityBookmarkCount` | `350`                                  | 半仿真书签数量                                                        |
| `diversityExcerptCount`  | （默认见 seeder）                      | 半仿真摘录数量                                                        |
| `noiseBookmarkCount`     | `400`                                  | 无关干扰书签数量                                                      |
| `noiseExcerptCount`      | （默认见 seeder）                      | 无关干扰摘录数量                                                      |
| `fillerSeed`             | `20260906`                             | 半仿真/干扰随机种子（可复现；不影响手写精选）                         |
| `chromeBookmarkSync`     | `'all'`                                | `'curated_only'` = 仅手写精选写 Chrome（半仿真/干扰可只进 Memory）    |
| `enrichCurated`          | `true`                                 | 用手写精选调 LLM 充实（耗配额）                                       |

**学生 / 知识工作者主题包（工程覆盖 · 非 §5.9）：**

```js
// 仅写入学生 + 知识工作者主题包（工程覆盖；非 §5.9）
await yiveno.seedRecallProbe({
  replace: true,
  personas: ['student', 'knowledge_worker'],
  diversityBookmarkCount: 120,
  diversityExcerptCount: 60,
  noiseBookmarkCount: 80,
  noiseExcerptCount: 40
})
```

| 主题包             | 精选侧重                       | 语料文件（`@yiveno/probe`）                            |
| ------------------ | ------------------------------ | ------------------------------------------------------ |
| `student`          | 课程 / 教材 / 引用 / 抽认卡    | `packages/yiveno-probe/src/corpus/student.ts`          |
| `knowledge_worker` | 政策 wiki / 会议 / 报销 / RACI | `packages/yiveno-probe/src/corpus/knowledge-worker.ts` |

**禁止：** 用扩展种库对外宣称 §5.9 Beta / 种子 TTE 达标；合成包只做回归与库形态覆盖。

**抽测线索（邻域含目标即过；非 Omnibox smoke 表）：**

| 画像             | clue（口语）                                            | 期望精选 key            |
| ---------------- | ------------------------------------------------------- | ----------------------- |
| student          | `purdue owl apa formatting guide I bookmarked`          | `owl-apa`               |
| student          | `untitled doc where I noted office hours Thu 2pm`       | `ex-pure-note-syllabus` |
| knowledge_worker | `notion page about expense policy for meals and travel` | `notion-expense`        |
| knowledge_worker | `notes doc where I wrote wait on vendor SSO reply`      | `ex-pure-note-standup`  |

**返回关注：** `bookmarkCount`（精选）、`indexRebuilt: true`、`probeKeys`（精选稳定键）。

**语料源：** `@yiveno/probe` → `packages/yiveno-probe/src/corpus/`。

**等价消息：** `{ scope: 'background', type: 'DEV_SEED_RECALL_PROBE', payload: { ... } }`

---

### 4.2 `yiveno.runProbeOmniboxSmoke`

**作用：** 不改库；用真实 Omnibox 召回路径（`entry: 'omnibox'`）验证手测文档 §4.1–4.2 的 11 条线索。

```js
const report = await yiveno.runProbeOmniboxSmoke()
// report.passed === report.total → 与探针库 + 手测文档对齐
```

**推荐顺序：** `seedRecallProbe` → `runProbeOmniboxSmoke` → 地址栏手动测 UI。

**单测：** `cd extension && bun run test:run -- recall-probe-omnibox-smoke`

**注意：** 与 `omnibox-eval`（eval 内存夹具、`Manifest V3` / `i18n:check` 等）**线索表不同**。

---

### 4.3 `yiveno.listRecallTelemetryEvents`

**作用：** 读取 `chrome.storage.local` 键 `yiveno.recallTelemetry`（最多 500 条）。

```js
const events = await yiveno.listRecallTelemetryEvents()
```

Side Panel 走一条 Recall 后应含 `clue_submitted`、`result_rendered`（含 `pipelineTiming`；可选 `waitProgress`）等。等待中关 Panel / 新找 / 改发 clue 应见 `wait_abandoned`（体验 · 与 TTE 分计）。详见 [TTE-种子用户研究-checklist](./TTE-种子用户研究-checklist.md) §2.2 · 产品文档 §7.0。

### 4.3a `yiveno.summarizeVisibleProgressTelemetry`

**作用：** 对本机缓冲做 §7.0 可见进展体验汇总（放弃率、改写次数等）。**禁止**当 §5.9 达标证据。

```js
const summary = await yiveno.summarizeVisibleProgressTelemetry()
// 或导出 JSON 后：bun run progress:summarize -- path/to/export.json
```

---

### 4.3b `yiveno.exportDualThreadAggregateSketch`

**作用：** 读取本机 TTE 缓冲，生成**匿名**暗线汇总草图（outcome / confirm 计数、`pipelineTiming` 分位草图）；**不含** clue 原文、memoryItemId、URL。

```js
const sketch = await yiveno.exportDualThreadAggregateSketch()
// 可粘贴进 dual-thread-notes「数据来源」；不得宣称人脑定律

const gap = yiveno.assessKnownGoldRecallGap({
  goldId: '…',
  goldInLibrary: true,
  candidateIds: ['…'], // 可选
  neighborhoodIds: ['…'],
  firstScreenSize: 5
})
// gap.stage → not_captured | candidate_miss | rank_wrong | unknown
```

### 4.4 `yiveno.checkClueGateway` / `checkClueGateway`

**作用：** 快速看线索是否被噪音网关拒绝，以及放行后的理解模式。

```js
yiveno.checkClueGateway('play some songs I like')
// → disposition: 'reject_noise'

yiveno.checkClueGateway('chrome extension migration')
// → disposition: 'proceed', understandingMode: 'lexical' | 'semantic'
```

---

### 4.5 `yiveno.backdateMemorySavedAt`

**作用：** 将指定 MemoryItem 的**保存时刻**回溯（摘录改 `createdAt`；书签同时改 `chromeCreatedAt`）。用于 TTE **冷却 / 时间窗**手测，避免真等 14 天。

```js
// 单条：回溯 21 天
await yiveno.backdateMemorySavedAt({
  ids: ['16e2db0d-0cb2-4018-8b9c-2cbf09cfb63a'],
  daysAgo: 21
})

// 批量 + 绝对时间
await yiveno.backdateMemorySavedAt({
  ids: ['uuid-a', 'uuid-b'],
  savedAtIso: '2026-08-01T12:00:00.000Z'
})
```

| 字段         | 说明                                            |
| ------------ | ----------------------------------------------- |
| `ids`        | 1–100 条 UUID                                   |
| `daysAgo`    | 相对今天 UTC 正午回溯（与 `savedAtIso` 二选一） |
| `savedAtIso` | 绝对 ISO datetime                               |

**边界：**

- 仅 DEV；生产构建不挂载。
- **禁止**用回溯后的库对外宣称 §5.9 Beta 达标；报告须标 `savedAt dev-adjusted`。
- 不改 `updatedAt`；不重建倒排（Recall 时间窗读运行时字段）。

**等价消息：** `{ scope: 'background', type: 'DEV_BACKDATE_MEMORY_SAVED_AT', payload: { ids, daysAgo } }`

---

## 5. Background 消息（DEV）

| type                           | payload                           | 响应                               | 说明                                             |
| ------------------------------ | --------------------------------- | ---------------------------------- | ------------------------------------------------ |
| `DEV_SEED_RECALL_PROBE`        | `Partial<SeedRecallProbePayload>` | `DevSeedRecallProbeResponse`       | 与 `yiveno.seedRecallProbe` 同实现               |
| `DEV_PROBE_CLEANUP`            | `ProbeCleanupPayload`             | `DevProbeCleanupResponse`          | 按层/类型/Chrome 选项批量清理                    |
| `DEV_PURGE_PROBE_NOISE`        | —                                 | `DevPurgeProbeNoiseResponse`       | 与 `yiveno.purgeProbeNoise` 同实现（噪声层快捷） |
| `DEV_BACKDATE_MEMORY_SAVED_AT` | `BackdateMemorySavedAtPayload`    | `DevBackdateMemorySavedAtResponse` | 与 `yiveno.backdateMemorySavedAt` 同实现         |
| `DEV_PROBE_LIBRARY_SNAPSHOT`   | —                                 | `DevProbeLibrarySnapshotResponse`  | Probe Console 库盘点                             |
| `DEV_LIST_PROBE_FIXTURES`      | `{ personas? }`                   | `DevListProbeFixturesResponse`     | 精选夹具目录（不写库）                           |

生产构建：`errorCode: 'DEV_ONLY'`。

---

## 6. 相关专题文档

| 主题                                           | 文档                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Omnibox 手测复制块 / 负例                      | [Omnibox-手测步骤](./Omnibox-手测步骤.md)                                          |
| 探针语料 Normative（量级、压力轮）             | 产品文档 §5.11.1a                                                                  |
| TTE 埋点与验收                                 | [R4-Phase-E-验收与eval](../archive/engineering/R4-Phase-E-验收与eval.md)（已归档） |
| `recall-eval` / `omnibox-eval`（CI，非探针库） | `extension/src/core/recall/eval/`                                                  |
| Background 全量 message type                   | [background-message-types.registry](./background-message-types.registry)           |

---

## 7. 附录：易混的 `yiveno.*` storage 键（非 SW API）

以下为 `chrome.storage.local` / `session` 持久化键，**不是**控制台脚本；勿与 §3 混用。

| 键                       | 用途                          | 配置方式                                        |
| ------------------------ | ----------------------------- | ----------------------------------------------- |
| `yiveno.recallTelemetry` | TTE 本机环形缓冲              | 自动写入；DEV 用 `listRecallTelemetryEvents` 读 |
| `yiveno.dev.clueLlm`     | 开发用线索 LLM（OpenAI 兼容） | DevTools → Application → Storage 手填 JSON      |
| `yiveno.userSettings`    | 用户设置                      | Settings UI                                     |
| `yiveno.recallPrefill`   | Side Panel 预填 clue          | `OPEN_RECALL_SHELL` 等                          |

完整行为以产品文档与 `extension/src/infrastructure/storage/`、`core/settings/` 为准。
