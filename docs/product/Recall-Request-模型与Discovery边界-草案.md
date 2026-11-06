# Recall Request 模型 + Discovery 边界（Normative · 晋升自草案 · D1 已裁决）

> **状态：** **Normative**（2026-10-06 晋升 · D1 裁决）；与 `docs/product/Yiveno-产品文档-v4.0.md` §7.05 一体。
> **目标：** 本文件保留为**完整正文**；晋升后产品文档 §7.05 为摘要引用（防止正文过长臃肿产品文档主文件）。
> **由来：** H-topic「主题必填」落地后暴露的更底层问题——**如何把无限开放的自然语言 Recall 压缩成有限问题空间**。
> **D1 裁决（2026-10-06）：** 选 **D1-B 退化弱 Topic**（见 §6 D1）。
> **权威链：** 术语表 → 本文件（Normative）→ 产品文档 §7.05（摘要）

---

## 0. 要解决的问题

**主语不是 Topic，是"Recall 的问题边界"。**

自然语言不像传统输入可以做 `正则 → Schema → Validation`：用户可以用任意句式表达任意意图。若不设边界，`understand → filter → rank` 面对的是一个**无限输入空间**，每次"再多理解一点"都只是把边界往后推，问题定义始终不收敛。

**本文件的主张：** 与其继续堆 NLP 能力，不如**先给 Recall 划一条问题边界**，把无限空间压成有限问题空间。

**Topic 不是"产品核心基线"——它是这条边界的"必要条件判定器"。** 当且仅当用户请求能落成一个**可识别的 Topic representation**，该请求才进入 Recall 问题域；否则它**不属于 Recall 范畴**（详见 §4 Discovery 边界）。

> ⚠️ **常见误读纠正：**
>
> - ❌ "Topic 是产品核心 → 一系列 Clues/Preferences 是 Topic 的业务辅助" → 把 Topic 当成"功能模块"
> - ✅ **"Recall 有问题边界 → Topic 是边界判定器 → Clues/Preferences/Discovery 都是这条边界的不同侧面"** → Topic 是必要条件，不是核心功能
> - ✅ 产品核心仍是 **Recall 找东西**本身；Topic 解决的是"什么算 Recall 什么问题不算"的前置判定

```text
∞ 自然语言
    ↓  边界判定（Topic 必要条件：能识别则进，不能则不进）
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

**逐条裁决（见 §6 D4）：** Discovery 的归宿是"暂不处理"还是"给一个明确出口文案（这不是找）"？无论哪种，都必须**避免**"后台无主题反复问主题"的死循环。

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

## 6. D1 已裁决 + 其余待定项（2026-10-06）

### D1（已裁决）：无 Topic 但"仅类型+时间"的请求 → D1-B 退化弱 Topic ✅

**裁决结论：选 D1-B。**

**理由：**

1. **"the video I watched yesterday" 实际上有隐式 Topic**：用户已经隐含说了"那个"——"我看过"的行为 + "video" 的内容类型，构成了一个弱但确实存在的根节点。它不是"无主题"，只是**没有内容词主题，只有类型+时间约束**。
2. **强语义一致性 ≠ 强产品体验**：选 D1-A，这整类查询就变成 `missing_topic`——对真实用户的真实召回意图是明显伤害。
3. **模型自洽**：承认两类入口——`Topic-driven`（强 Topic）与 `Preference-driven`（弱 Topic，即 `objectTypes` + `timeRange` 共同构成退化 Topic）。
4. **路径完整性**：保留 `recallMatchesByConstraintNeighborhood` 作为一等路径，与现有用户习惯和已有测试保持一致。

**最终模型：Topic 有两种来源**

| 来源类型                          | 触发条件                                        | 例子                                                 |
| --------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| **Topic-driven（强 Topic）**      | 有内容词（名词实体/专有名词等）                 | "Model 3 那个" / "上次看到讲限速的文章"              |
| **Preference-driven（弱 Topic）** | 无内容词，但有 `objectTypes` + `timeRange` 约束 | "the video I watched yesterday" / "上周读的那篇文章" |

> **注意**：时间置信度 `timeConfidence=high` 是 Preference-driven 路径的必要条件（ADR-011）。

### D2（未裁决）：Clues 是否要扩槽（人物/地点/情境）？

- D2-A：维持扁平 `contentTerms`（现状），把"人物/地点"当普通内容词。
- D2-B：引入结构化 Clue 槽（人物/地点/情境），支撑未来邻域与解释。

### D3（已裁决 · D3-C）：Topic 的表示演进（词法 → 语义）

**D3-C 裁决（2026-10-06）：Topic 终态 = 语义表示（embedding / entity）；直接语义化。**

**理由：**

1. **语义化是正确的终态方向**：Topic 作为"先验收窄"的边界判定器，词法表示（terms）只是中间占位；embedding/entity 才是能真正支撑语义邻域的形态。
2. **直接语义化路径**：不采用「词法逐步升级」的演进路径；一步到位接入 embedding 产出 Topic 嵌入。
3. **与 Gap 4 的关系**：Gap 4（Topic 语义角色重建）是 D3-C 的第一步——架构上建立 Topic 独立检索路径（`topicLookup`）；本轮 `topicEmbedding` 参数预留，embedding 产出可用时上拨接入。

**现状（Gap 4 + Gap 5 落地后）：**

- `RecallTopic.terms: string[]`（词法）仍是当前实现（tokens 作为可读表示）
- `RecallTopic.embedding?: Float32Array`（Gap 5）：真实 embedding 由 `deriveTopicEmbedding` 产出
- `topicLookup` 独立检索路径已建立（embedding 路径真实接入 + 词法 fallback 保留）
- `withRecallTopicAsync`：幂等回填 + embedding 填充（仅登录态）
- `buildTopicDescriptor`：embedding 透传到 TopicDescriptor

**演进路径（Gap 5 已落地）：**

- `deriveTopicEmbedding`：调用现有 embedding 通道，产出 Topic embedding
- `topicLookup` 内 `topicEmbedding !== undefined` 时，调用 `cosineSimilarity` 计算近邻
- 全库无 embedding 条目时降级词法路径
- entity index 可用时，调用 entity match
- 词法路径作为 fallback 保留

### D4（未裁决）：Discovery 分支的归宿？

- D4-A：**暂不处理**（保持 `missing_topic` + 问主题）。
- D4-B：给**明确出口文案**（"这更像探索，不是找"）+ 不重复问主题。
- 无论哪种：必须消除"无主题反复追问"的死循环。

---

## 7. 若采纳的分阶段落地（示意 · 待 D1 定后细化）

| 阶段   | 目标                                   | 触碰面                                                                             |
| ------ | -------------------------------------- | ---------------------------------------------------------------------------------- |
| **P0** | 文档化本模型 + 必要条件门              | ✅ 已落地（§5.2.1 / §5.11.2 / 术语表）；本草案晋升 §7.x                            |
| **P1** | Topic 作为**先验空间缩减**出现在管线中 | `understand` 层 + 候选加载顺序；`recall-topic.ts` 语义化；**Gap 5 已落地（D3-C）** |
| **P2** | Clues / Preferences **分层**           | `ParsedRecallClue` 结构拆分；Framing / Explain 对齐                                |
| **P3** | **Discovery 出口**                     | Framing 分支（`missing_topic` 之外的归宿）；可能的新 `outcome`                     |

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

---

## 主线现状与差距摘要（2026-10 对齐轮）

> 本节由 2026-10 对齐轮补充（`docs/audits/Recall-主线与文档对齐-2026-10.md`）。仅做事实陈述，不修改草案原文。

### 1. 现状

当前 Recall 主线**不是**"基于 topical 展开"——`parsed.topic` 字段存在（`deriveRecallTopic` 派生），也出现在 Topic Gate 和 Framing 事实中，但它**没有参与候选加载的空间缩减**，也没有作为独立语义角色贯穿到最终结果。草案 §2 主张的「Topic → Memory Neighborhood → Candidate Items → Re-ranking」架构中，后两步**未实现**。

### 2. 草案 §2 主张架构 vs 实际

| 草案 §2 主张                                               | 代码实际                                                                          | 状态       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- |
| Topic → Memory Neighborhood → Candidate Items → Re-ranking | Topic 出现在 Gate 层与 contentTerms 中；候选加载全量；无 Memory Neighborhood 概念 | **未落地** |

### 3. 5 个 gap（与产品文档/草案对比后的差距）

1. **候选加载不依赖 Topic 先验**（严重度高，工作量中）——全量 MemoryItem 加载，无 Topic 先验缩减
2. **Framing 层无 Topic 独立表述**（严重度中，工作量小）——RecallResult 和 Framing fact 均无独立 topic 字段
3. **RecallResult 无 topic 字段**（严重度中，工作量小）——`parsed.topic` 存在于 ParsedRecallClue 内，但 RecallResult 接口无独立 topic 字段
4. **Topic 作为 contentTerms 并入，语义角色丢失**（严重度中，工作量大，依赖 D3 决策）——`buildFilterClueFromParsed` 直接把 Topic terms 并入 filterClue，Topic 降级为普通内容词
   → **✅ Gap 4 已修复（2026-10）：** D3-C 裁决后，`topicLookup` 独立检索路径已加；Topic 走独立路径（`topicLookup`），contentTerms 走关键词检索（`buildFilterClueFromParsed`）；两路结果并集·去重；本轮占位词法路径；`topicEmbedding` 参数预留
5. **D3 Topic 语义化缺失**（严重度中-低，工作量大，依赖 D3 决策）——当前 `RecallTopic.terms: string[]` 为词法；终态为语义表示（embedding/entity）
   → **✅ Gap 5 已修复（2026-10）：** D3-C 裁决后，`deriveTopicEmbedding` + `withRecallTopicAsync` + topicLookup embedding 路径真实接入；仅登录态可用；降级词法保留

### 4. 推荐修复顺序（gap 间依赖）

#### P0（主流程骨架修复，不依赖 D2/D3/D4）

- **gap 1**（候选加载 Topic 先验）——词法先验可独立推进；影响 §5.9 TTE，须配套 eval
- **gap 2**（Framing Topic 独立表述）——仅 Framing fact 新增字段 + 模板调整
- **gap 3**（RecallResult topic 字段）——接口加字段；调用处填充

#### P1（语义表示层修复，D3-C 已裁决）

- **gap 4（Topic 语义角色重建）**——✅ 已修复（2026-10）；D3-C 裁决后，`topicLookup` 独立检索路径已加
- **gap 5（Topic 语义化）**——✅ 已修复（2026-10）；D3-C 裁决后，`deriveTopicEmbedding` + `withRecallTopicAsync` + topicLookup embedding 路径真实接入；仅登录态可用；降级词法保留

#### P0 可并行，P1 串行等待 D3

- gap 1/2/3 可**同时推进**，相互独立
- gap 4 在 gap 1（词法先验）之后能更顺畅
- gap 5 须等 D3 决策落地

### 5. 与 D2/D3/D4 决策的关系

- **D2/D3/D4 决策搁置**（2026-10-06）
- **D3 决策**（Topic 词法/语义演进路径）是 gap 4/5 的前置
- **主流程骨架修复（P0：gap 1/2/3）不依赖 D2/D3/D4**，可独立推进

### 6. 下一步

由维护者拍板：是否启动 P0 修复（gap 1/2/3）；或者先拍 D3 方向后再动。
