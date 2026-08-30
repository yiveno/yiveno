# DEV 调试 API（Service Worker · 索引）

> **范围：** 开发构建（`import.meta.env.DEV`）在 Service Worker 挂到 `globalThis.yiveno` 的调试入口，及等价的 Background 消息。  
> **非范围：** 生产用户能力、`recall-eval` / `omnibox-eval` 内存夹具、普通 `chrome.storage.local` 键（见文末附录）。  
> **维护：** 新增/变更 API 须同步更新 **本文** + 对应 `expose-*-debug.ts` 文件头注释 +（若有消息）`background-message-types.registry`。

---

## 1. 怎么调用

1. `cd frontend && bun run build`（或 `build:watch` 已产出最新 `dist/`）
2. `chrome://extensions` → 重新加载 Yiveno
3. 点 **Service Worker**「检查」→ Console
4. 输入下文 API（多数须 `await`）

启动时 SW 会打印一行摘要，例如：`[yiveno] DEV：SW 可用 yiveno.seedRecallProbe ...`

---

## 2. 代码维护入口

| 层级            | 路径                                                  | 职责                                                 |
| --------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| **注册**        | `frontend/src/background/main.ts`                     | 启动时 `exposeXxxDebug()`                            |
| **挂载**        | `frontend/src/infrastructure/debug/expose-*-debug.ts` | 挂 `globalThis.yiveno.*`；`import.meta.env.DEV` 门禁 |
| **实现**        | `frontend/src/infrastructure/debug/*.ts`              | 探针种库、Omnibox 冒烟等                             |
| **消息 schema** | `frontend/src/core/messaging/debug-messages.ts`       | Zod payload；`DEV_*` 类型                            |
| **消息分发**    | `frontend/src/background/handlers/message-handler.ts` | `DEV_SEED_RECALL_PROBE` 等                           |
| **登记册**      | `docs/engineering/background-message-types.registry`  | 消息 `type` 与 handler 对齐（`bun run doc:check`）   |

### 新增 API 清单（维护者）

1. 在 `infrastructure/debug/` 写实现（或扩展现有 service）
2. 新建/扩展 `expose-*-debug.ts`，合并进 `host.yiveno`（勿覆盖已有键）
3. 在 `background/main.ts` 调用 `exposeXxxDebug()`
4. 若需 Side Panel / 页面 `sendMessage`：先 `core/messaging/debug-messages.ts` → handler → `background-message-types.registry`
5. **更新本文 §3 总表** + 链到专题手测/Normative 文档
6. 文件头 JSDoc 写一行用法；SW 启动 `console.info` 提示可调 API

---

## 3. `globalThis.yiveno` API 总表

| API                                  | 类型                | 干什么                                                | 实现                                                                 | 专题文档                                                           |
| ------------------------------------ | ------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `yiveno.seedRecallProbe(payload?)`   | `async`             | 种入召回探针语料（书签 + Memory + 倒排重建）          | `expose-recall-probe-seed-debug.ts` → `recall-probe-seed-service.ts` | 产品文档 §5.11.1a；[Omnibox-手测步骤](./Omnibox-手测步骤.md) §2    |
| `yiveno.runProbeOmniboxSmoke()`      | `async`             | 对当前库跑 11 条 Omnibox 轨冒烟（§4.1–4.2 线索）      | `recall-probe-omnibox-smoke.ts`                                      | [Omnibox-手测步骤](./Omnibox-手测步骤.md) §2.1                     |
| `yiveno.probeOmniboxCopyPaste`       | `readonly string[]` | 手测地址栏复制块（含 `yi ` 前缀）                     | `recall-probe-omnibox-smoke.ts`                                      | 同上 §4.1–4.2                                                      |
| `yiveno.listRecallTelemetryEvents()` | `async`             | 读本机 TTE 七事件环形缓冲                             | `expose-recall-telemetry-debug.ts` → `recall-telemetry-store.ts`     | [R4-Phase-E-验收与eval](./R4-Phase-E-验收与eval.md)；产品文档 §5.9 |
| `yiveno.checkClueGateway(clue)`      | sync                | 测噪音网关 + 放行时理解模式（`lexical` / `semantic`） | `expose-clue-gateway-debug.ts`                                       | —                                                                  |
| `checkClueGateway(clue)`             | sync                | 同上（历史兼容，挂 SW 顶层）                          | 同上                                                                 | —                                                                  |

**门禁：** 上表全部仅 DEV 构建；`vite build --mode production` 不挂载。

---

## 4. API 说明

### 4.1 `yiveno.seedRecallProbe`

**作用：** 写入探针测试库，供 Recall / Omnibox MCP 手测。

**默认（质量档，约千级 Memory）：**

```js
await yiveno.seedRecallProbe({ replace: true })
```

**常用参数：**

| 字段                     | 默认                                   | 说明                                                 |
| ------------------------ | -------------------------------------- | ---------------------------------------------------- |
| `replace`                | `true`                                 | 清空当前 owner Memory + Chrome 书签栏子树后重种      |
| `personas`               | `['researcher','creator','developer']` | 画像语料                                             |
| `noiseBookmarkCount`     | `400`                                  | 噪声书签                                             |
| `diversityBookmarkCount` | `350`                                  | 多样性书签                                           |
| `chromeBookmarkSync`     | `'all'`                                | `'curated_only'` = 压力 ~20k（多样性/噪声仅 Memory） |
| `enrichCurated`          | `true`                                 | 精选条调度 LLM enrichment（烧配额）                  |

**返回关注：** `bookmarkCount`（精选）、`indexRebuilt: true`、`probeKeys`（精选稳定键）。

**语料源：** `frontend/src/infrastructure/debug/recall-probe-corpus-*.ts`

**等价消息：** `{ scope: 'background', type: 'DEV_SEED_RECALL_PROBE', payload: { ... } }`

---

### 4.2 `yiveno.runProbeOmniboxSmoke`

**作用：** 不改库；用真实 Omnibox 召回路径（`entry: 'omnibox'`）验证手测文档 §4.1–4.2 的 11 条线索。

```js
const report = await yiveno.runProbeOmniboxSmoke()
// report.passed === report.total → 与探针库 + 手测文档对齐
```

**推荐顺序：** `seedRecallProbe` → `runProbeOmniboxSmoke` → 地址栏手动测 UI。

**单测：** `cd frontend && bun run test:run -- recall-probe-omnibox-smoke`

**注意：** 与 `omnibox-eval`（eval 内存夹具、`Manifest V3` / `i18n:check` 等）**线索表不同**。

---

### 4.3 `yiveno.listRecallTelemetryEvents`

**作用：** 读取 `chrome.storage.local` 键 `yiveno.recallTelemetry`（最多 500 条）。

```js
const events = await yiveno.listRecallTelemetryEvents()
```

Side Panel 走一条 Recall 后应含 `clue_submitted`、`result_rendered`（含 `pipelineTiming`）等。详见 [TTE-种子用户研究-checklist](./TTE-种子用户研究-checklist.md) §2.2。

---

### 4.4 `yiveno.checkClueGateway` / `checkClueGateway`

**作用：** 快速看线索是否被噪音网关拒绝，以及放行后的理解模式。

```js
yiveno.checkClueGateway('play some songs I like')
// → disposition: 'reject_noise'

yiveno.checkClueGateway('chrome extension migration')
// → disposition: 'proceed', understandingMode: 'lexical' | 'semantic'
```

---

## 5. Background 消息（DEV）

| type                    | payload                           | 响应                         | 说明                                                              |
| ----------------------- | --------------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `DEV_SEED_RECALL_PROBE` | `Partial<SeedRecallProbePayload>` | `DevSeedRecallProbeResponse` | 与 `yiveno.seedRecallProbe` 同实现；schema 见 `debug-messages.ts` |

生产构建：`errorCode: 'DEV_ONLY'`。

---

## 6. 相关专题文档

| 主题                                           | 文档                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Omnibox 手测复制块 / 负例                      | [Omnibox-手测步骤](./Omnibox-手测步骤.md)                                |
| 探针语料 Normative（量级、压力轮）             | 产品文档 §5.11.1a                                                        |
| TTE 埋点与验收                                 | [R4-Phase-E-验收与eval](./R4-Phase-E-验收与eval.md)                      |
| `recall-eval` / `omnibox-eval`（CI，非探针库） | `frontend/src/core/recall/eval/`                                         |
| Background 全量 message type                   | [background-message-types.registry](./background-message-types.registry) |

---

## 7. 附录：易混的 `yiveno.*` storage 键（非 SW API）

以下为 `chrome.storage.local` / `session` 持久化键，**不是**控制台脚本；勿与 §3 混用。

| 键                       | 用途                          | 配置方式                                        |
| ------------------------ | ----------------------------- | ----------------------------------------------- |
| `yiveno.recallTelemetry` | TTE 本机环形缓冲              | 自动写入；DEV 用 `listRecallTelemetryEvents` 读 |
| `yiveno.dev.clueLlm`     | 开发用线索 LLM（OpenAI 兼容） | DevTools → Application → Storage 手填 JSON      |
| `yiveno.userSettings`    | 用户设置                      | Settings UI                                     |
| `yiveno.recallPrefill`   | Side Panel 预填 clue          | `OPEN_RECALL_SHELL` 等                          |

完整行为以产品文档与 `frontend/src/infrastructure/storage/`、`core/settings/` 为准。
