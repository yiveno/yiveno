---
created: 2026-10-30T08:28:50+08:00
updated: 2026-10-30T08:28:50+08:00
author: agent:cursor
scope: L1 parse-gold 真实 LLM 基线 · DeepSeek V4 Flash vs Qwen Flash · schemaVersion 2 / field-v1
status: baseline-captured
upstream:
  - docs/audits/2026-10-L1线索理解层评估体系完善-实施前审计.md
  - docs/audits/2026-10-多模型检索研究-研发基线盘点.md
  - docs/audits/2026-10-三类模型独立评测与归因方案.md
  - docs/audits/snapshots/2026-10-30-parse-gold-deepseek-v4-flash-field-v1.json
  - docs/audits/snapshots/2026-10-30-parse-gold-qwen-flash-field-v1.json
downstream:
  - 可选：Qwen null noteHint / 缺数组 的 schema 适配另开；exclude day-hike 形态另开；勿用本结果改生产
---

# L1 线索理解 · DeepSeek V4 Flash vs Qwen Flash 基线评测（2026-10-30）

> **本轮约束已遵守：** 未改金标 / 生产 NLU / Prompt / Worker / 裁判 / L2·L3 / §5.9；未跑 OpenAI。  
> **证据分级：** FACT = 本机 JSON 快照；INFERENCE = 由证据合理推断；意见 = 主观判断。  
> **禁止冒充：** 本基线 ≠ 生产体验 ≠ §5.9；Overall 仅辅助；Schema 通过率 ≠ 槽位语义。

---

## 0. 执行前检查结论（FACT）

| 项                 | 结论                                                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 指标接线           | `slotAgreement` 含 `excludeContentTerms`；正/负分列；`schemaVersion: 2`；`protocol: field-v1`；`metricKind: field_agreement`                                                                                               |
| 金标               | `PARSE_GOLD_CASES` **42**（must **35** / stretch **7**）                                                                                                                                                                   |
| 时钟               | `PARSE_GOLD_NOW_MS` = `2026-07-28T12:00:00.000Z`（两组同用）                                                                                                                                                               |
| DeepSeek 入口      | `PARSE_GOLD_LLM_COMPAT=deepseek` · model `deepseek-v4-flash` · base `https://api.deepseek.com` · Key `DEEPSEEK_API_KEY`                                                                                                    |
| Qwen 入口          | `PARSE_GOLD_LLM_COMPAT=dashscope` · model `qwen-flash` · base `https://dashscope.aliyuncs.com/compatible-mode/v1` · Key `DASHSCOPE_API_KEY`                                                                                |
| 阻塞               | **无**（不改生产代码即可跑）                                                                                                                                                                                               |
| 操作风险（已规避） | ① Qwen **必须**显式 `BASE_URL`（CLI 默认仍是 DeepSeek）；② 默认 `JSON_OUT` 会覆盖已有 `…-qwen-flash.json` → 本轮用 `*-field-v1.json`；③ 旧 DeepSeek 快照为 schema **1** / **37** 案，**不可**与本轮 slotAgreement 静默对比 |

---

## 1. 运行元数据（FACT）

|                            | DeepSeek V4 Flash                                                             | Qwen Flash                                                             |
| -------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **model id**               | `deepseek-v4-flash`                                                           | `qwen-flash`                                                           |
| **compat**                 | `deepseek`                                                                    | `dashscope`                                                            |
| **baseUrl**                | `https://api.deepseek.com`                                                    | `https://dashscope.aliyuncs.com/compatible-mode/v1`                    |
| **Key 源（名）**           | `DEEPSEEK_API_KEY`                                                            | `DASHSCOPE_API_KEY`                                                    |
| **cases / gate**           | 42 / `all`                                                                    | 42 / `all`                                                             |
| **nowMs**                  | `1785240000000`                                                               | 同左                                                                   |
| **gitSha**                 | `a4c434d9…`                                                                   | 同左                                                                   |
| **fingerprints**           | 与对组 **完全一致**                                                           | 同左                                                                   |
| **capturedAt (UTC)**       | `2026-10-30T00:27:07.010Z`                                                    | `2026-10-30T00:27:43.344Z`                                             |
| **墙钟（completer 合计）** | ≈ **35.6 s**（latency 求和 34163 ms）                                         | ≈ **32.2 s**（30756 ms）                                               |
| **JSON 报告**              | `docs/audits/snapshots/2026-10-30-parse-gold-deepseek-v4-flash-field-v1.json` | `docs/audits/snapshots/2026-10-30-parse-gold-qwen-flash-field-v1.json` |
| **控制台日志**             | `…-field-v1-console.txt`（同目录）                                            | 同左                                                                   |

生产对照（FACT · 非本轮调用路径）：Worker 默认 `AI_HOSTED_MODEL=deepseek-v4-flash`；离线 CLI 直连 DeepSeek API，**不等于**生产 AI Gateway `deepseek/deepseek-flash` 路径已证明等价。

---

## 2. 工程健康（FACT）

| 指标                          | DeepSeek          | Qwen                         |
| ----------------------------- | ----------------- | ---------------------------- |
| Schema / Pipeline pass        | **42/42 (100%)**  | **32/42 (76.2%)**            |
| must pass                     | **31/35 (88.6%)** | **21/35 (60.0%)**            |
| stretch pass                  | **6/7 (85.7%)**   | **4/7 (57.1%)**              |
| 失败总数                      | 5（全 `slot`）    | 17（`schema` 10 + `slot` 7） |
| latency mean / p50 / max (ms) | 813 / 831 / 1420  | 732 / 700 / 1185             |
| prompt tokens 合计            | 34259             | 33838                        |
| completion tokens 合计        | 1963              | 2023                         |
| total tokens 合计             | 36222             | 35861                        |

规则侧（两组相同 runner）：must **35/35** · stretch **5/7**。

---

## 3. 字段级 Agreement（FACT · field-v1）

### 3.1 Positive（主口径）

|                   | DeepSeek      | Qwen          |
| ----------------- | ------------- | ------------- |
| denominator       | **42**        | **42**        |
| mean agreement    | **0.978**     | **0.715**     |
| timeLabel hit     | 1.000 (28/28) | 0.714 (20/28) |
| objectTypes hit   | 1.000 (36/36) | 0.750 (27/36) |
| behaviorHints hit | 1.000 (13/13) | 0.538 (7/13)  |
| noteHint hit      | 1.000 (4/4)   | 1.000 (4/4)   |
| contentTerms hit  | 0.971 (34/35) | 0.743 (26/35) |
| confidence hit    | 0.946 (35/37) | 0.676 (25/37) |

### 3.2 Negative（主口径）

|                         | DeepSeek    | Qwen        |
| ----------------------- | ----------- | ----------- |
| denominator             | **5**       | **5**       |
| mean agreement          | **0.600**   | **0.600**   |
| excludeContentTerms hit | 0.600 (3/5) | 0.600 (3/5) |

未声明 exclude 的案 **不进** negative 分母（NA）；half_read 等未挂 `excludeContentTermsEmpty` 者仍不进分母。

### 3.3 Overall（辅助）

|             | DeepSeek  | Qwen      |
| ----------- | --------- | --------- |
| denominator | 42        | 42        |
| mean        | **0.954** | **0.707** |

---

## 4. 失败案例分类（FACT + INFERENCE）

### 4.1 共同失败（5）

| caseId                                              | DeepSeek                                           | Qwen                                 | 归因分层（意见）                               |
| --------------------------------------------------- | -------------------------------------------------- | ------------------------------------ | ---------------------------------------------- |
| `p0-long-time-ago-bookmark`                         | confidence high→medium                             | 同                                   | **模型校准** vs 金标偏严（两模一致）           |
| `must-wwii-related-video`                           | contentTerms 含 `related`                          | 同                                   | **模型理解**（过宽抽词）；金标明确 MustExclude |
| `must-exclude-yellowstone-lodging-not-hike`         | exclude 缺 `day-hike`（有 hike/packing/checklist） | **schema**：非法 `timeLabel`         | DS=**词面形态**；QW=**结构映射前 Zod 失败**    |
| `must-exclude-conflict-shared-topic-stays-positive` | 同上缺 `day-hike`                                  | 同上缺 `day-hike`                    | **理解/词面**：复合词 `day-hike` 未保留        |
| `stretch-password-staging-stored`                   | confidence                                         | contentTerms 缺 staging + confidence | QW 更重；金标 confidence 偏严                  |

### 4.2 DeepSeek 独有

无（失败集 ⊆ Qwen 失败集）。

### 4.3 Qwen 独有 · Schema（10）— 主因 `noteHint: null` / 缺数组 / 非法枚举

| 模式                                             | 代表 case                                                         | 说明                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `noteHint` 收到 `null`（Zod 要 boolean 或 omit） | `p0-time-type-entity-li-bai` 等 7 案                              | **结构契约**：模型填 null；提案 schema `z.boolean().optional()` 拒 null → 整案 `解析失败` |
| `contentTerms` undefined                         | `p0-while-ago-half-read-article` · `p0-code-deployment-last-week` | **结构契约**                                                                              |
| `timeLabel` 非法枚举值                           | `must-exclude-yellowstone-lodging-not-hike`                       | **结构契约**（枚举外字符串）                                                              |

Schema 失败时 runner 用空 stub `parsed` 算 agreement → **会压低** Qwen positive mean（协议事实，非「槽位语义」单独结论）。

### 4.4 Qwen 独有 · Slot（额外）

| caseId                               | 现象                           | 归因分层（意见）         |
| ------------------------------------ | ------------------------------ | ------------------------ |
| `p0-assistant-like-songs`            | 缺 `like`；confidence low      | **模型理解**漏行为词     |
| `must-uncertain-not-sure-no-exclude` | 缺 `privacy`（exclude 空正确） | **正向漏提**；负向槽通过 |
| `stretch-never-finished-writeup`     | 缺 `deployment`                | **模型理解**             |

### 4.5 排除槽细读（denominator=5）

| case                              | DS                        | QW                                 |
| --------------------------------- | ------------------------- | ---------------------------------- |
| Yellowstone lodging not hike      | fail（`hike`≠`day-hike`） | schema fail                        |
| conflict shared topic             | fail（同）                | fail（同）                         |
| hike checklist 正向 empty exclude | pass                      | pass                               |
| uncertain no exclude              | pass                      | pass（exclude）；但正向 content 漏 |
| plain query no exclude            | pass                      | pass                               |

→ 负向 mean **同为 0.6** 是「同一分母上各过 3/5」的巧合对齐，**不是**两模排除能力等价的充分证明（QW 一案死在 schema，未进入可裁判的 exclude 语义比较）。

---

## 5. 模型对比摘要

| 维度           | DeepSeek V4 Flash         | Qwen Flash             | 标签                |
| -------------- | ------------------------- | ---------------------- | ------------------- |
| Positive mean  | **0.978**                 | 0.715                  | FACT                |
| Negative mean  | 0.600                     | 0.600                  | FACT（解释见 §4.5） |
| must / stretch | 88.6% / 85.7%             | 60.0% / 57.1%          | FACT                |
| Schema 稳      | 100%                      | 76.2%                  | FACT                |
| 延迟 p50       | 831 ms                    | **700 ms**             | FACT（略快）        |
| Token 合计     | 略高 prompt               | 略高 completion        | FACT                |
| 生产默认候选   | 是（hosted 同 id 字符串） | 否（仅离线 dashscope） | FACT                |

**意见（非实测体验）：** 在本协议与本机单次全量下，DeepSeek 在 Schema 稳定与正向槽上明显领先；Qwen 主要短板是 **输出契约**（null / 缺字段 / 非法枚举），其次才是槽位语义。负向排除两模都卡在 `day-hike` 词面，属共享弱点。

**证据边界：**

1. 单次离线金标 ≠ 生产 Gateway 路径；≠ Side Panel 体验。
2. `temperature=0` 仍有跨跑波动：同日较早 Qwen 快照（`2026-10-30-parse-gold-qwen-flash.json`，git `6c8af2c9`）must **25/35**、本轮 **21/35**；NLU 指纹文件未变，仅 judge/metrics 指纹变 → **INFERENCE：模型非完全确定**，对比宜钉单次快照或多次均值（本轮未做多次）。
3. Schema 失败案的 field agreement 基于空 stub，读 Qwen positive 时须与 Schema 分列解读。
4. 未测 OpenAI；未改 Prompt 试探 Qwen 契约。

---

## 6. 评测环境 / 协议问题

| 问题                                  | 严重度   | 说明                                                                     |
| ------------------------------------- | -------- | ------------------------------------------------------------------------ |
| Qwen 须手设 `BASE_URL`                | 操作脚枪 | 默认 base 仍 DeepSeek；本轮已显式设置                                    |
| 默认 JSON 路径会覆盖同日同 model 快照 | 已规避   | 使用 `*-field-v1.json`                                                   |
| Schema 失败 → agreement 用空 stub     | 解读陷阱 | 勿把 Qwen positive 低分全算「不懂槽」                                    |
| 旧 DS schema1 / 37 案                 | 对比禁令 | 勿与本轮混表                                                             |
| must 回归时 CLI exitCode              | 观察     | 本轮 shell 见 exit 0；报告内 `mustRegressedByLlm` 仍完整（以 JSON 为准） |

**无**金标被改、**无**裁判被改、**无**部分结果冒充全量。

---

## 7. 下一阶段建议（不做本轮）

1. **记录优先：** 保持本两份 `*-field-v1.json` 为 schemaVersion 2 对照锚点。
2. **若要抬 Qwen 可比性（另开）：** 仅离线适配 `null→omit` / 缺少数组默认，或 Prompt 明示「勿输出 null」——须单独实验，**禁止**借机改金标。
3. **exclude `day-hike`：** 先分清是模型词面、映射规范化，还是金标过严复合词；另开，勿本轮修。
4. **confidence 金标：** `long_time_ago` / password stretch 两模常 medium——可另开「金标松紧」审阅，非本轮。
5. **仍不要**用本表直接换生产模型或宣称 §5.9。

---

## 8. 命令复现（不含 Key）

```bash
cd extension

# DeepSeek
PARSE_GOLD_LLM_COMPAT=deepseek \
PARSE_GOLD_LLM_MODEL=deepseek-v4-flash \
PARSE_GOLD_LLM_BASE_URL=https://api.deepseek.com \
PARSE_GOLD_LLM_GATE=all \
PARSE_GOLD_LLM_JSON_OUT=../docs/audits/snapshots/2026-10-30-parse-gold-deepseek-v4-flash-field-v1.json \
bun run parse-gold:llm

# Qwen
PARSE_GOLD_LLM_COMPAT=dashscope \
PARSE_GOLD_LLM_MODEL=qwen-flash \
PARSE_GOLD_LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 \
PARSE_GOLD_LLM_GATE=all \
PARSE_GOLD_LLM_JSON_OUT=../docs/audits/snapshots/2026-10-30-parse-gold-qwen-flash-field-v1.json \
bun run parse-gold:llm
```
