# Recall Request 模型 + Discovery 边界（草案 · Non-normative）

> **状态：** **草案（Draft）**，含**待裁决项**；**非** Normative，不得据此对外宣称能力。
> **目标：** 裁决后晋升为产品文档 §7.x（`Yiveno-产品文档-v4.0.md`）；晋升前正文以本页为讨论稿。
> **由来：** H-topic「主题必填」落地后暴露的更底层问题——**如何把无限开放的自然语言 Recall 压缩成有限问题空间**。
> **权威链：** 术语表 → 本草案（讨论）→ 产品文档 §7.x（裁决后）。

---

## 0. 要解决的问题

自然语言不像传统输入可以做 `正则 → Schema → Validation`：用户可以用任意句式表达任意意图。若不设边界，`understand → filter → rank` 面对的是一个**无限输入空间**，每次"再多理解一点"都只是把边界往后推，问题定义始终不收敛。

**本草案的主张：** 与其继续堆 NLP 能力，不如先给 Recall 划一个**必要条件**，把无限空间压成有限问题空间：

```text
∞ 自然语言
    ↓  边界判定（必须能落成 Topic）
有限 Memory 域
    ↓
Recall Pipeline（understand → filter → rank）
```

**边界一旦确定，`understand → filter → rank` 才终于有了明确的问题定义。**

---

## 1. 提议模型：Recall Request

```text
Recall Request
│
├── Topic         必填（根节点 · 必要条件）
│
├── Clues         可选
│   ├── 人物 / 地点 / 情境 / 内容片段 / 时间描述 / 其他模糊线索
│
└── Preferences   可选
    ├── 类型（article / video / …）
    ├── 来源（domain / host）
    └── 时间范围
```

**状态机：**

```text
User Input
    │
    ▼
能否识别 Topic？
    ├── 否 → 缺 Recall 最小信息 → 详见 §4 Discovery 边界
    └── 是 → 提取 Clues / Preferences → Recall → Ranking → Results
```

**关键措辞（重要）：**

- ❌ 旧说法："没有主题就是无意义的寻找请求"
- ✅ 新说法：**"没有可识别 Topic 的请求，不属于 Yiveno 当前定义的 Recall 问题。"**

差别在于：后者承认那是**另一类问题**（Discovery），而不是否定用户。

---

## 2. Topic 是根节点，不只是字段

不要把 Topic 当成 `interface RecallQuery { topic: string }` 这种普通字段。它在认知模型上是 **Recall 的根节点**，同时承担**两个职责**：

1. **语义锚点** —— 定义"要找的东西是关于什么的"。
2. **搜索空间缩减器** —— 决定候选空间的大小。

```text
"我想找以前存的那个东西"          → 候选空间 = 全部记忆 ████████████████
"我想找以前关于 Model 3 的那个"    → 汽车 ████████ → Tesla ████ → Model 3 ██
"+ 高速 续航"                      → 更小的候选空间 → Ranking → Results
```

因此管线里 **Topic 应出现在"先验缩小候选空间"那一步**，而不是仅仅并入检索词：

```text
        Topic
          │
          ▼
   Memory Neighborhood      ← 本草案主张：这一步现在是缺的
          │
          ▼
     Candidate Items
          │
          ▼
      Re-ranking
```

> **注意：** embedding 只是**实现手段**，Topic 的"先验收窄"是**问题定义**。当前实现把 embedding 当成了缩小空间的主要手段，本草案主张 Topic 才是根。

---

## 3. Topic 是语义层，不是表单字段

**"Topic 必须存在" ≠ "Topic 必须是用户显式输入的一个字段"。**

用户可以说："前几天我在看那个讲为什么中国高速公路限速设计不合理的东西。"——不需要任何表单，系统从中提取：

```text
Topic:  中国高速公路 / 限速设计
Clues:  前几天 · 设计不合理 · 文章
```

因此 UI 层**未必**需要 `Topic: [____]`，真正的约束存在于**语义层**：

> 每一个进入 Recall Pipeline 的请求，必须至少形成一个**可信的 Topic representation**。

---

## 4. Discovery 边界

人类"记得有一个东西特别有意思，但完全不知道是什么、也不知道关于什么"——这**不一定无意义**，只是它属于：

**Discovery / Serendipity / Exploration**，而不是 Recall。

**本草案主张的边界：**

```text
                 用户想找东西
                      │
             ┌────────┴────────┐
             │                 │
        知道主题            不知道主题
             │                 │
             ▼                 ▼
          RECALL           DISCOVERY
             │                 │
        Yiveno 核心        暂不处理（明确归宿，非死循环）
```

**逐条裁决（见 §6 D4）：** Discovery 的归宿是"暂不处理"还是"给一个明确出口文案（这不是找回）"？无论哪种，都必须**避免**"后台无主题反复问主题"的死循环。

---

## 5. 现状差距（对照代码与文档 · 截至 2026-09-27）

| 模型项                                | 现状                                                                                                   | 差距                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------- |
| **Topic 必填（必要条件）**            | ✅ 已有门：`hasRecallTopicAnchor`（`core/recall/recall-topic.ts`）；无主题 → `emptyKind=missing_topic` | 基本落地                |
| **Topic 是根节点 / 空间缩减器**       | ❌ Topic 仅做「过门 + 并入 `contentTerms`」；候选缩小仍靠倒排 + embedding 全局匹配                     | **最大缺口**            |
| **Clues（人物/地点/情境…）**          | ⚠️ 扁平：只有 `contentTerms` / `behaviorHints` / `noteHint`，无人物/地点/情境槽位                      | 分类学粗一档            |
| **Preferences（类型/来源/时间范围）** | ✅ 有 `objectTypes` / `timeRange`(±`timeConfidence`)                                                   | 存在但未分层            |
| **Topic 是语义层、非表单字段**        | ✅ 一致：Topic 由 `deriveRecallTopic` **派生**；UI 从不问 "Topic: \_\_\_\_"                            | 已对齐                  |
| **无 Topic → Discovery（非 Recall）** | ⚠️ 只做到"拒绝"：返回 `missing_topic` 并问"这是关于什么的？"；无 Discovery 概念、无出口                | 边界未画                |
| **状态机：能否识别 Topic？**          | ✅ 即该门；同"必要条件"                                                                                | 已对齐（含例外，见 D1） |

**代码层已知的自认局限：** `recall-topic.ts` 头部注释写明"判定基于解析结果的**词法表示**（非泛词内容词）；这与『Topic 是语义表示』的终态仍有距离"——即当前 Topic 是**词法**的，不是**语义**的。

**文档层已落地（本草案若晋升需迁移/对齐）：**

- 产品文档 §5.2.1 #11（主题必填手验）、§7（结果三分 + 流水线）、§5.11.2 `missing-topic-no-retrieval`
- 术语表「主题锚」「`missing_topic`」

---

## 6. 待裁决项（DECISION NEEDED）

### D1（关键）：无 Topic 但"仅类型+时间"的请求，算不算 Recall？

现状：`recallMatchesByConstraintNeighborhood` 是**一等的可检索路径**（如 "the video I watched yesterday"：无内容词，但有 `objectTypes=video` + `timeRange`）。这与"Topic 必填"的**严格读法冲突**。

| 选项                                         | 含义                                                            | 影响面                                                          |
| -------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| **D1-A 严格**：不算 Recall → `missing_topic` | "只有类型+时间"视为无 Topic；符合"Topic 严格必要条件"           | 回退约束邻域检索；需改 13 处测试 + eval + `memory-item-service` |
| **D1-B 退化弱 Topic**（当前实现倾向）：算    | 承认两类入口：`Topic-driven` 与 `Preference-driven`（弱 Topic） | 模型需显式写明"Topic 有两种来源"；保留现有约束邻域路径          |

> **备注：** 现状实现 = D1-B（上一轮已选）。**若采纳 D1-A，需一并回退该路径。** 本草案**不预设结论**。

### D2：Clues 是否要扩槽（人物/地点/情境）？

- D2-A：维持扁平 `contentTerms`（现状），把"人物/地点"当普通内容词。
- D2-B：引入结构化 Clue 槽（人物/地点/情境），支撑未来邻域与解释。

### D3：Topic 的表示演进（词法 → 语义）？

- 现状：`RecallTopic.terms: string[]`（词法，非泛词内容词）。
- 终态主张：Topic 是**语义表示**（嵌入/实体），能真正"先验收窄"。
- 需裁决：演进路径与触发条件（何时从词法升级语义）。

### D4：Discovery 分支的归宿？

- D4-A：**暂不处理**（保持 `missing_topic` + 问主题）。
- D4-B：给**明确出口文案**（"这更像探索，不是找回"）+ 不重复问主题。
- 无论哪种：必须消除"无主题反复追问"的死循环。

---

## 7. 若采纳的分阶段落地（示意 · 待 D1 定后细化）

| 阶段   | 目标                                   | 触碰面                                                         |
| ------ | -------------------------------------- | -------------------------------------------------------------- |
| **P0** | 文档化本模型 + 必要条件门              | ✅ 已落地（§5.2.1 / §5.11.2 / 术语表）；本草案晋升 §7.x        |
| **P1** | Topic 作为**先验空间缩减**出现在管线中 | `understand` 层 + 候选加载顺序；`recall-topic.ts` 语义化       |
| **P2** | Clues / Preferences **分层**           | `ParsedRecallClue` 结构拆分；Framing / Explain 对齐            |
| **P3** | **Discovery 出口**                     | Framing 分支（`missing_topic` 之外的归宿）；可能的新 `outcome` |

**硬约束（沿用 ADR-005）：** 禁止内容别名 / 开放同义表冒充通解；单次 miss 不得改排序主路径。

---

## 8. 与既有决策的关系

| 既有                         | 关系                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| H-topic / 主题必填           | 本草案是其**上位模型**：Topic 必填只是"必要条件"这一条         |
| ADR-011 时间置信度           | 时间是 **Preference**，不构成 Topic（见 §1 分层）              |
| ADR-005 无灰名单             | Topic 缩减必须对全用户同一规则，非专名 alias                   |
| ADR-010 理解流水线           | Topic 抽取属 `understand` 层产物                               |
| §7.0 结果三分 / §7.2 Outcome | Discovery 若成为新 `outcome`，需与结果三分、Outcome 结算树对齐 |

---

## 引用

- 产品文档 §0 / §5.2.1 / §5.9 / §5.11.2 / §7 / §7.2
- 术语表「主题锚」「`missing_topic`」「clue」
- ADR-005 / ADR-010 / ADR-011
- 代码：`core/recall/recall-topic.ts` · `core/recall/parse-recall-clue-types.ts` · `core/recall/orchestrate-keyword-recall.ts` · `application/recall/backends/hybrid-recall-backend.ts`
