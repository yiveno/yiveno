# TTE 种子用户研究 · 执行 Checklist

> **性质：** 可打印/可勾选的**操作流程**（Non-normative 细节；**门禁阈值以产品文档 Normative 为准**）。  
> **Normative：** [`Yiveno-产品文档-v4.0.md`](../product/Yiveno-产品文档-v4.0.md) **§5.9**、**§5.10.3**、§0.1.1「首发用户与种子验证」。  
> **协议原文：** `yiveno_research/TTE_指标框架与测试协议.md`。  
> **R4 工程：** [`R4-Phase-E-验收与eval.md`](./R4-Phase-E-验收与eval.md)

---

## 0. 这份 checklist 解决什么

- **不**替代产品文档；只把 §5.9 的 90 天验证 + TTE 协议落成**可执行步骤**。
- **不测**竞品公开秒数排行榜（研究禁止）；只测 **Yiveno vs 用户现有拼装方案**（浏览器 书签/Raindrop/搜索 等）在**同一语料、同一模糊任务**下的 TTE。
- **成功定义：** 用户更快拿到**可自验的原始证据**（ECS 五要素齐全），而不只是「AI 说找到了」。

---

## 1. 研究设计快照

| 项         | 建议值                        | 可调范围                                   |
| ---------- | ----------------------------- | ------------------------------------------ |
| 阶段       | Beta（种子用户真实库）        | Alpha 可先用内部 6–10 人                   |
| 参与者     | 20–30 人 / 2 周 diary         | 最少 12 人仍可做方向性判断                 |
| 每人任务数 | 10 个模糊任务                 | 至少 5 个才够算 P50                        |
| 资料冷却   | ≥14 天前保存                  | PMF 队列含 30/90 天分层                    |
| 观测窗口   | **180 秒 / 任务**             | 超时记 `task_timeout`，右删失              |
| 对照       | 参与者**当前习惯**方案 1 种   | 例：Chrome 书签搜索 / Raindrop / 纯 Google |
| 语言       | **American English** 口语线索 | 与产品文档 P0 一致                         |

---

## 2. 四周滚动计划（最小可行）

### 第 1 周 · 准备（研究负责人）

- [ ] **2.1** 确认扩展版本号 `vX.Y` 与构建渠道（dev / 内测包）。
- [ ] **2.2** 埋点就绪检查（§5.9 七事件；无埋点则**仅**手停表 + 录屏，并在报告中注明）。
- [ ] **2.3** 编写 **Gold Task 模板**（§6）并预填 10 条**内部** gold（团队自己的库）。
- [ ] **2.4** 准备 **ECS 标注指南**（§7）+ 双标注表格。
- [ ] **2.5** 准备 **知情同意** 要点：录屏范围、数据存本地/导出、可随时退出、不收集 Chrome 全站 history。
- [ ] **2.6** 招募文案：对准 §0.1.1 三群（研究者 / 创作者 / 开发者），强调「找自己存过的东西」非助理。
- [ ] **2.7** 内部试跑 3 任务 → 修正 prompt 歧义、计时 SOP。

**本周退出：** 内部 3/3 任务可复现记录 t0→TTE-V→TTE-C。

---

### 第 2 周 · Alpha 基准（6–10 人，可含团队）

- [ ] **2.8** 每人库内 **≥30** 条可用 Memory（摘录优先；含 2+ 带 note）。
- [ ] **2.9** 研究员据库生成 **10 gold tasks / 人**（冷却 ≥14 天的条目 ≥5）。
- [ ] **2.10** 每人完成 **10 任务 × Yiveno only**（或 +1 对照，若时间够）。
- [ ] **2.11** 双标注 ECS + gold match；分歧第三人仲裁。
- [ ] **2.12** 填 **§8 报告模板** 一行（Alpha 行）。
- [ ] **2.13** 写 **失败 taxonomy** Top 5（parser / ranking / explain UI / 无 archive / UX）。

**Alpha 门禁（§5.9）：**

| 指标                            |  阈值 | 本轮结果 |
| ------------------------------- | ----: | -------- |
| Success@180                     |  ≥70% | **\_**   |
| ECS 合格率                      |  ≥90% | **\_**   |
| TTE-V P50                       |  ≤15s | **\_**   |
| Top-3 Precision（钉死一条子集） | ≥0.70 | **\_**   |

- [ ] **2.14** 未达标 → **停止扩招募**；优先 R4 Explain + ranking（§5.11），不加 Agent/连接器。

---

### 第 3–4 周 · Beta 种子 diary（20–30 人）

**入组（每人）：**

- [ ] **2.15** 15 分钟 onboarding：划存 3 摘录 + 导入/同步书签（若适用）。
- [ ] **2.16** 确认符合首发画像（会存、会几周后找、在乎来源）。
- [ ] **2.17** 发放 diary：第 7 / 14 天各 **1 次**主动 Recall（自填线索即可，不计入 TTE 正式任务）。

**正式 TTE 会话（每人 1 次，45–60 分钟）：**

- [ ] **2.18** 同一设备、网络、登录态；Side Panel 主路径。
- [ ] **2.19** 随机顺序：**5 任务 Yiveno** + **5 任务 对照方案**（或 10 Yiveno + 对照另约，但语料须相同）。
- [ ] **2.20** 禁止会话中外挂 Google 查目标（允许「平时会这样」的对照习惯仅在对照 arm）。
- [ ] **2.21** 录屏 + 事件日志（若已埋点）。
- [ ] **2.22** 每任务结束问：**「你找到的是要找的吗？」** → `user_confirmed` yes/no/unsure。

**Beta 门禁（§5.9）：**

| 指标        | 阈值 | 本轮结果 |
| ----------- | ---: | -------- |
| Success@180 | ≥75% | **\_**   |
| ECS 合格率  | ≥92% | **\_**   |
| TTE-V P50   | ≤12s | **\_**   |
| TTE-V P90   | ≤45s | **\_**   |
| Median IB   |   ≤2 | **\_**   |

- [ ] **2.23** `Success@180 < 70%` → **暂缓收费测试**（产品文档 §5.9）。
- [ ] **2.24** 31–60 天阶段：**≥60%** 任务 Yiveno top-3 优于对照（主观 + 客观 TTE-V 双看）。

---

### 第 5–8 周（可选）· 交叉对照与分群

- [ ] **2.25** 按来源分层报告：仅摘录 / 仅书签 / 混合 / 有 note。
- [ ] **2.26** 按资料年龄：7–30d / 31–90d / 90d+。
- [ ] **2.27** 按分群：研究者 vs 创作者 vs 开发者（n 小则只做方向性）。
- [ ] **2.28** 5–8 人 **付费意向**深访（§5.9 61–90 天：≥15% 明确 Pro 意向）。

---

## 3. 参与者筛选（快速否决）

**要：**

- [ ] 每周至少 1 次「先存再说」习惯（划词/书签/稍后读任一）。
- [ ] 过去 30 天有过「记得存过但想不起标题」的经历。
- [ ] 愿意英文口语 Recall（P0 产品范围）。
- [ ] 同意录屏（可打码密码/私信区域）。

**不要（硬排除）：**

- [ ] 几乎不 Capture、库空为主。
- [ ] 期望 Yiveno 当 ChatGPT 助理 / 推荐「现在干嘛」。
- [ ] 仅想要文件夹整理器、不要 Recall。
- [ ] 无法使用 Chrome 扩展（除非另有构建）。

---

## 4. 单次任务执行 SOP（研究员 / 受试者）

```
[准备] 读出任务 ID + 模糊 prompt（不得补充提示）
  ↓
[t0] 受试者提交 query → 记录 query_submitted
  ↓
[观察] 等待结果卡；记录 result_rendered / evidence_visible
  ↓
[判定 ECS] 五要素是否齐全？齐全 → 停 TTE-V 表
  ↓
[点击] 受试者打开原文/详情 → source_opened
  ↓
[确认] 「是你要的吗？」→ user_confirmed
  ↓
[若否] 允许 query_refined；IB+1；Wrong-path 若误开无关卡
  ↓
[180s 到] 仍未 ECS 达标 → task_timeout，记 censored
```

**Interaction Burden（IB）计数：** 每次 `query_refined`、换筛选、滚动超过一屏找卡、误点无关结果各 +1。

---

## 5. 五类任务模板（每人至少覆盖 3 类）

从**该参与者自己的库**选 gold 条目，**不得**用公共维基/官网凑数。

| 类型            | 模糊 prompt 模板（英）                                                             | Gold 须预填                 |
| --------------- | ---------------------------------------------------------------------------------- | --------------------------- |
| **内容+时间**   | “I saved something about `{concept}` a few weeks ago, maybe mentioned `{detail}`.” | target id, 14–90d, 关键句   |
| **来源+概念**   | “Something I saved from `{domain}` about `{topic}`.”                               | url/domain 匹配             |
| **备注锚点**    | “The page where I left myself a note about `{note_token}`.”                        | `clues.note` 含 token       |
| **行为+未完成** | “That article I didn’t finish reading…”                                            | half_read / 长摘录          |
| **钉死一条**    | “That `{type}` I `{behavior}` last `{time}`.”                                      | song/article + opened/saved |

**禁止作 prompt：** 完整标题、完整 URL、连续 10+ 字原文粘贴。

---

## 6. Gold Card 模板（每任务一张）

复制到表格或 Notion；测试前由**非受试者**填写。

```markdown
## Task ID: T-{participant}-{01}

- **Participant:**
- **Save age (days):**
- **Intent:** pin-down | browse-cluster
- **Fuzzy prompt (read aloud):**
- **Primary gold MemoryItem id:**
- **Acceptable alternates:** id1, id2（可为空）
- **Key anchor (quote ≤20 words):**
- **Min ECS:** 5
- **Expected difficulty:** easy | medium | hard
- **Notes for annotators:**
```

---

## 7. ECS 快速标注（0–5）

|  分 | 条件                          | 停 TTE-V？            |
| --: | ----------------------------- | --------------------- |
|   1 | 来源身份（域名/页名/类型）    | 否                    |
|   2 | + 一键可达（URL 或 detail）   | 否                    |
|   3 | + 内容锚点（摘录/高亮/标题）  | 否                    |
|   4 | + 保存时间或来源语境          | **是（Beta 合格线）** |
|   5 | + 命中理由（字段/token 说明） | **是（推荐）**        |

**任务成功（TTE 计 Success@180）：** ECS≥4 **且** gold match **且** `user_confirmed=yes`。

**邻域成功（产品会话 KPI，与 TTE 并行记录）：** 钉死一条 → top-3 含 gold；逛一簇 → 短名单含 gold 且 ≥1 条同簇。

---

## 8. 版本报告模板（每次发版填一行）

| 版本      | n任务/n人 | TTE-V P50/P90 | TTE-C P75 | Success@180 | ECS≥4 | Top-3 Prec | Med IB | Top 失败原因 |
| --------- | --------: | ------------: | --------: | ----------: | ----: | ---------: | -----: | ------------ |
| v\_\_\_\_ |         / |         s / s |         s |           % |     % |          % |        |              |

**失败原因枚举（勾选）：** `parse_fail` · `rank_wrong` · `explain_missing` · `no_archive` · `ux_friction` · `consent_scope` · `user_gave_up`

---

## 9. 90 天产品决策门（与 §5.9 对齐）

| 时段   | 决策                  | Go                                                | No-Go 动作            |
| ------ | --------------------- | ------------------------------------------------- | --------------------- |
| 0–30d  | 继续招募 / 扩功能？   | ≥70% 首次会话 5 saves；≥60% 7d 内检索             | 只做 Capture/导入 UX  |
| 31–60d | 进入定价实验？        | ≥60% 任务 top-3 赢对照；TTE-V 优于对照            | parser/rerank/Explain |
| 61–90d | 公开 MCP / 多连接器？ | ≥35% WAU 每周检索≥2；≥15% Pro 意向；Beta TTE 门禁 | **禁止** MCP 宣传     |

---

## 10. 伦理与隐私（最低线）

- [ ] 录屏前口头确认；提供停止权利。
- [ ] 导出/上传录屏前**手动检查**是否含密码、银行、健康等；可剪除。
- [ ] 不对照方案读取 Yiveno **未 Capture** 的 Chrome 全站 history（产品禁止）。
- [ ] 研究数据与生产账号分离存储；参与者可要求删除录屏与日志。
- [ ] 对外发布仅聚合数据；不贴可识别摘录正文。

---

## 11. 研究包文件清单（建议目录）

```text
research/tte-beta-{YYYY-MM}/     ← 从模板复制：research/tte-beta-template/
  consent-template.md
  screener.md
  gold-cards/
    P001-T01.md …
  sessions/
    P001-events.jsonl
    events.schema.json
  annotations/
    P001-T01-ecs.csv
  report-vX.Y-beta.md
```

**模板目录（可提交 git）：** [`research/tte-beta-template/`](../../research/tte-beta-template/README.md)

---

## 12. 与 recall-eval 的关系

| 层       | 工具                          | 用途                        |
| -------- | ----------------------------- | --------------------------- |
| CI       | `recall-eval` must（§5.11.2） | 回归防倒退                  |
| 种子 TTE | 本 checklist                  | 真实库、真实延迟、ECS、对照 |
| 手工     | §5.10.1 Explain               | 发版前 15 分钟              |

**不得**用 eval corpus 的 TTE 数字冒充种子用户 Beta 达标。

---

## 修订记录

| 日期       | 变更                                              |
| ---------- | ------------------------------------------------- |
| 2026-08-24 | 初版：四周计划、SOP、gold/ECS 模板、90 天决策门   |
| 2026-08-24 | 链至 `research/tte-beta-template/` 可复制目录骨架 |
