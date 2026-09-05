# 单人研究者 SOP（维护者 · 真实库）

> **性质：** 无团队时的 TTE 内部试跑流程；**不**等同于 §5.9 Beta 达标（须 n≥12 + 对外参与者）。  
> **库：** 仅使用维护者个人真实 Chrome 库（禁止 `seedRecallProbe({ replace: true })`）。  
> **Normative 门槛：** 产品文档 §5.9 · 完整 checklist：`docs/engineering/TTE-种子用户研究-checklist.md`

---

## 0. 本包用途

| 路径                  | 说明                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `gold-cards/`         | 每任务一张；填真实 `MemoryItem` id（**勿 commit 含 PII 的成品**） |
| `sessions/`           | 录屏 + `P001-events.jsonl`（本地 only）                           |
| `annotations/`        | ECS 标注（单人可自标 + 隔日复标）                                 |
| `report-vX.Y-beta.md` | 版本报告；n=1 行须标 **内部试跑**                                 |

---

## 1. 一次性准备（≈30 分钟）

1. **构建：** `cd frontend && bun run build` → `chrome://extensions` 重新加载 Yiveno（记下扩展 ID）。
2. **埋点自检：** Side Panel 提交一条 clue → DevTools → Application → `chrome.storage.local` → `yiveno.recallTelemetry`  
   或 SW Console：`await yiveno.listRecallTelemetryEvents()`
3. **挑 gold 源：** 打开 `library.html`，选 **10 条** Memory（冷却 ≥14 天 ≥5 条；含 2+ 带附注；覆盖 checklist §5 五类任务至少 3 类）。  
   **探针清库（可选）：** SW Console `await yiveno.purgeProbeNoise()` — 清噪声/多样性层，保留精选语料；移除 Chrome「Yiveno Probe」文件夹。
4. **复制模板：** `gold-cards/_TEMPLATE.md` → `P001-T01.md` … `P001-T10.md`；填 id、fuzzy clue、key anchor。
5. **版本行：** `report-vX.Y-beta.md` 填扩展 `manifest.json` 版本（当前 4.0.0）。

---

## 2. 单次任务 SOP（≈5–8 分钟 / 任务）

```
[冷启动] 新 Tab 无关页 · 打开 Side Panel · 可选 New find 清线程
[t0]     朗读 gold card 上的 fuzzy clue → 输入 → 提交
[观察]   等结果卡；自评 ECS 0–5（卡面五要素）
[停表]   ECS≥4 且与 gold 相关 → 记 TTE-V（秒）
[点击]   打开原文/详情 → 记 TTE-C
[确认]   「是你要的吗？」→ yes / no / unsure（诚实）
[记录]   填 gold card 底部 Session log；追加 sessions/P001-events.jsonl
```

**IB 计数：** 每次 refine clue、换筛选、误点无关卡 +1。

**禁止：** 任务中用 Google 外挂查目标（对照 arm 除外）。

---

## 3. 遥测导出与汇总

**导出（Side Panel 或 SW Console）：**

```js
// Side Panel DevTools Console
const { yiveno_recallTelemetry } = await chrome.storage.local.get('yiveno.recallTelemetry')
copy(JSON.stringify(yiveno_recallTelemetry, null, 2))
```

保存为 `sessions/P001-telemetry-export.json`（**勿 commit**）。

**汇总：**

```bash
bun run tte:summarize -- research/tte-beta-2026-09/sessions/P001-telemetry-export.json
```

将输出行抄入 `report-vX.Y-beta.md` §8 表，备注 `n=1 · 内部 · 非 Beta`。

---

## 4. 真实 Capture 养库（14 天冷却 · 当前阶段）

> **目标：** 2 周内攒够 **≥5 条真实摘录/书签**（`保存天数 ≥ 14`），含 **≥2 条带附注**；届时重选 gold（含替换 miss 的 T01）。  
> **背景：** 清库后库内 74 条多为精选探针；仅 2 条真实 `example.com`。探针 batch 对拍 **9/10 top-3** 已够用工具验证，**不能**冒充 §5.9。

### 4.1 每日节奏（≈5 分钟）

| 动作             | 频率        | 说明                                        |
| ---------------- | ----------- | ------------------------------------------- |
| **摘录 1 条**    | 每天 1 条   | 正常浏览时划选 Capture；优先长段 / 有锚点句 |
| **附注 1 句**    | 隔日或当场  | 英文口语 `clues.note`（为何存、以后怎么找） |
| **书签（可选）** | 每周 2–3 条 | 仅当会几周后靠「站点+主题」找回             |
| **Recall 自测**  | 每周 1 次   | 用模糊 clue 试找刚存的，不记正式 TTE        |

### 4.2 五条「有意图」Capture（覆盖 checklist 类型）

养库时按下面五类各至少 1 条，避免全存同一域：

| 类型        | 怎么存                               | 附注示例（英文）                          |
| ----------- | ------------------------------------ | ----------------------------------------- |
| 内容+时间   | 文章里划一句带 **独特 token** 的句子 | `cite in Q4 retro`                        |
| 来源+概念   | 书签或摘录；记得 **域名+主题**       | `onboarding perf checklist`               |
| 附注锚点    | 弱标题页；靠 **note 钉死**           | `ask eng about cache invalidation`        |
| 行为+未完成 | 长段 / 没读完的页                    | `stopped halfway — need the failure mode` |
| 近因钉死    | 刚读完立刻 Capture                   | `saved today for demo`                    |

### 4.3 硬规则

```
✅ 真实浏览路径 Capture（划选 / 书签灌库）
✅ 附注用英文、短句、未来自己能懂
✅ 继续用现有库做 Recall 抽测（MCP / Side Panel）
✅ DEV 回溯保存时刻（仅内部手测，见下 §4.3.1）
❌ seedRecallProbe({ replace: true }) 或任何整库重种
❌ 为过 gold 而存「假线索」或 eval 语料复制
❌ 用 dev-adjusted 保存时刻对外宣称 §5.9 Beta 达标
```

#### 4.3.1 DEV：回溯保存时刻（免等 14 天）

> 实现：`docs/engineering/DEV-调试API.md` §4.5 · 仅 DEV 构建。

```js
// chrome://extensions → Yiveno → Service Worker Console
await yiveno.backdateMemorySavedAt({
  ids: [
    '16e2db0d-0cb2-4018-8b9c-2cbf09cfb63a', // example.com 摘录
    '3bd21d4b-8cca-4cf2-b0b2-4b77adbe77f8' // 待测 gold
  ],
  daysAgo: 21
})
```

**适用：** 真实 Capture 内容已就位，只差冷却门槛；报告须标 `savedAt dev-adjusted`。  
**不适用：** 冒充种子用户真实库达标、或替代「几周后找回」的产品命题验证。

### 4.4 两周里程碑

| 日期（约）      | 检查                                                                |
| --------------- | ------------------------------------------------------------------- |
| **D+0（今天）** | 记 baseline：`library.html` 摘录数；开始第 1 条真实 Capture         |
| **D+7**         | 摘录 ≥7；附注 ≥3；快速扫一眼能否写出 3 条 fuzzy clue                |
| **D+14**        | ≥5 条 `保存天数 ≥ 14` → 重选 10 gold（替换 T01 + 逐步换掉探针条目） |
| **D+14+**       | 按 §2 手跑 10 任务批 + `user_confirmed` / ECS                       |

**进度自记（本地）：** 在 `sessions/capture-cooldown-log.md` 追加行（日期 · 类型 · 有无附注 · 域）；**勿 commit** 若含可识别 URL 片段。

---

## 5. 阶段退出条件

| 阶段              | 任务数 | 退出                                                     |
| ----------------- | -----: | -------------------------------------------------------- |
| **工具验证**      |      3 | 3/3 可复现 t0→TTE-V→TTE-C；埋点七事件齐全                |
| **内部 Alpha 行** |     10 | 填报告 + 失败 taxonomy Top 5；**不**对外宣称达标         |
| **真实养库**      |  14 天 | ≥5 条冷却 ≥14d + ≥2 附注 → 重选 gold                     |
| **扩招募**        |      — | 仅当愿意招募 ≥12 外部参与者时进入 checklist §2 第 3–4 周 |

---

## 6. 失败 taxonomy（勾选）

`parse_fail` · `rank_wrong` · `explain_missing` · `no_archive` · `ux_friction` · `user_gave_up`

---

## 7. 与 Agent 协作

- 测试默认真实库；Agent 可直接 MCP Side Panel 抽测，无需逐次询问。
- Gold card 草稿可由 Agent 根据 Library 条目生成；**fuzzy clue 与 id 由你最终确认**。
- `user_confirmed` 只能由你本人填写，Agent 不得代填。
