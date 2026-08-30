# Yiveno 术语表（Glossary）

> **Normative · 术语唯一权威**  
> 本文定义 Yiveno 产品、工程、文档、AI 协作中**所有核心概念的叫法与边界**。  
> **冲突时：** 术语含义以**本文为准**；行为/契约/实现细节以 `Yiveno-产品文档-v4.0.md` §0–§7 为准；视觉以 `Yiveno-设计标准-v1.md` 为准。  
> **改术语：** 先改本文 → 再同步产品文档、设计标准、`.cursor/rules/terminology.mdc`、`AGENTS.md`、代码标识符与 i18n。  
> **主要读者：** 维护者、AI 编程工具、写文档/PR/测试语料者。

---

## 0. 使用约定

### 0.1 三层语境

| 层             | 语言                  | 用途                                                    | 示例                                       |
| -------------- | --------------------- | ------------------------------------------------------- | ------------------------------------------ |
| **产品面**     | 仅美式英语            | 扩展 UI、官网、用户可见错误/空态、对外 slogan、验收语料 | clue · Recall · library · evidence         |
| **工程面**     | 英文标识符 + 中文注释 | 代码、Zod、消息 type、日志 scope                        | `clue` · `MemoryItem` · `RECALL_WITH_CLUE` |
| **开发者讨论** | 中文 OK               | 对话、commit、工程文档备注                              | 线索 · 找回 · 邻域 · 附注                  |

**铁律：** 产品面向用户的内容**禁止**中文 locale 与非 en 主文案；开发者材料可用中文，但首次出现核心概念时建议括号标注英文标识符一次。

### 0.2 本文不定义什么

- **不**替代产品文档中的行为契约、配额、消息协议、验收步骤——见 `Yiveno-产品文档-v4.0.md`。
- **不**定义色板、控件气质——见 `Yiveno-设计标准-v1.md`。
- **不**收录实现细节（函数名、阈值常量）——见代码与工程文档；本文只给**概念锚点**与**禁止误用**。

---

## 1. 产品定位（一句话锚点）

| 概念                         | 英文                    | 中文（开发讨论）            | 定义                                                                                             |
| ---------------------------- | ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| **产品心智**                 | —                       | 那个找东西的 / 仓库         | 帮用户**找回自己主动存过的个人痕迹**；不是书签管理器、笔记工具、聊天机器人、生活助理             |
| **核心分解**                 | Capture + Recall        | 保存低负担 + 找回高置信邻域 | 扔进就记着 + 想找就找得着                                                                        |
| **北极星**                   | neighborhood retrieval  | 邻域找回                    | 模糊线索 → 第一屏进入**正确邻域**；交付排序相关集合（报 N，首屏 ≤5，可续展），**非**神谕唯一答案 |
| **用户选 Yiveno 的唯一理由** | understand fuzzy speech | 听懂随便说的话              | 不必整理文件夹、不必记精确标题；加一点线索即可走进记忆邻域                                       |

**禁止对外承诺：** 「每次押中那一条」「永远唯一正确答案」「全知助理」。

---

## 2. 两大产品动作

| 概念        | 英文    | 中文           | 定义                                                                | 用户面怎么说                     |
| ----------- | ------- | -------------- | ------------------------------------------------------------------- | -------------------------------- |
| **Capture** | Capture | 保存 / 捕获    | 用户**主动**留下个人痕迹（划词、书签 sync、导入等）                 | save · capture a trace           |
| **Recall**  | Recall  | 找回           | 用户用口语描述记忆，从自己的库里**找**曾经存过的东西                | find · recall what you saved     |
| **Filter**  | Filter  | 筛选（仅对内） | **检索执行层**机制（关键词 + 硬约束 + 可选 Hybrid）；不是用户动作名 | **禁止**对用户说 Filter / Search |

```
Capture（存）  →  MemoryItem 入库
Recall（找）   →  clue 输入  →  理解  →  Filter/Hybrid  →  邻域结果
```

**禁用用户面术语：** Search · 搜索 · query（作产品名词）· prompt（作产品名词）· question（作产品名词）。

---

## 3. 用户输入：clue（线索）★

> **这是「用户输入的内容」在 Yiveno 里的标准叫法。**

| 概念             | 英文                       | 中文            | 定义                                                                           |
| ---------------- | -------------------------- | --------------- | ------------------------------------------------------------------------------ |
| **线索**         | **clue** / **recall clue** | 线索 / 口语线索 | 用户在 **Recall composer**（Side Panel / Omnibox）中输入的**自然语言记忆描述** |
| **解析后线索**   | `ParsedRecallClue`         | 解析结果        | 将 clue 拆成时间、对象类型、行为、内容词等**可检索约束**的结构化结果           |
| **有效线索原文** | `effectiveClue`            | 有效原文        | 多轮会话合并后的线索全文（单轮时约等于 `clue`）                                |

**典型 clue 示例（产品面 · 英语）：**

- `yesterday saved a poem about Li Bai`
- `the article I didn't finish reading`
- `note about the deployment page`

**不叫 clue 的输入：**

| 误称              | 为何不适用                                 |
| ----------------- | ------------------------------------------ |
| query             | 搜索引擎心智；产品用户输入统一称 **clue**  |
| prompt            | LLM/聊天产品心智；Yiveno 不是聊天机器人    |
| question          | 用户不是在提问，是在**复述记忆对象**       |
| search string     | 违反 Filter/Recall 术语纪律                |
| input（作领域名） | 太泛；仅作 UI 控件描述（clue input field） |

**工程锚点：** `RECALL_WITH_CLUE` · `recallWithClue(clue)` · `RecallResult.clue` · `parseRecallClue` · i18n `popup_clue_*`

---

## 4. 资产与存储

### 4.1 库与条目

| 概念            | 英文            | 中文            | 定义                                                               |
| --------------- | --------------- | --------------- | ------------------------------------------------------------------ |
| **个人痕迹**    | personal trace  | 个人痕迹        | 用户附着在原文上的私有内容；Yiveno 核心资产                        |
| **记忆库 / 库** | library         | 记忆库 / 库     | 用户全部可找回条目的集合                                           |
| **记忆条目**    | `MemoryItem`    | 记忆条目 / 条目 | IndexedDB 中一条可找回对象；有稳定 `id`（对内身份，非对外 slogan） |
| **事实源**      | source of truth | 事实源          | 本地 IndexedDB `MemoryItem`；模型输出不是事实源                    |

### 4.2 条目类型（MVP 可写）

| 概念                 | 英文                                     | 中文             | 角色                               |
| -------------------- | ---------------------------------------- | ---------------- | ---------------------------------- |
| **摘录**             | `text_excerpt` / `bookmark` 类型中的摘录 | 摘录             | **主角**；划词保存的正文片段       |
| **书签**             | `bookmark`                               | 书签             | **配角**；Chrome 书签 sync         |
| **预留 `note` 类型** | `note`（类型）                           | （勿与附注混淆） | **当前不做**；有边界需求但不在范围 |

### 4.3 附注 vs 线索 vs clues 字段 ★（最易混）

| 概念                 | 英文                       | 中文                  | 是什么                                                                 | 不是什么                    |
| -------------------- | -------------------------- | --------------------- | ---------------------------------------------------------------------- | --------------------------- |
| **附注**             | `clues.note` / **note**    | 附注                  | 存于**条目上**、给未来自己的短提示（Capture 时或事后写入）             | 独立笔记库；`note` 条目类型 |
| **线索（用户输入）** | **clue**                   | 线索                  | **Recall 时**用户在 composer 输入的口语                                | `MemoryItem.clues` 整包     |
| **条目线索字段**     | `clues`（MemoryItem 字段） | 条目 clues / 线索字段 | 条目上的可问元数据：`note`、`tags`、`keywords`、`entities`、行为字段等 | 用户本轮 Recall 输入        |

```
用户说的 clue              →  动词侧 · 本轮找回输入
MemoryItem.clues           →  名词侧 · 条目存库字段
MemoryItem.clues.note      →  附注 · 存时写的私有提示
```

**开发讨论 shorthand：** 说「附注」= `clues.note`；说「线索」= 用户 `clue`；说「条目 clues」= 字段对象。

### 4.4 Capture 入口

| 概念         | 英文           | 定义                                                                                                                                                               |
| ------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **捕获入口** | `captureEntry` | `popup`（**遗留枚举 id**，原 Action Popup 时代默认来源；≠ Side Panel 找回主壳）· `context_menu` · `selection_toolbar` · `omnibox` · `shortcut` · `sync` · `import` |

---

## 5. Recall 结果与体验

### 5.1 邻域（核心承诺）

| 概念         | 英文                      | 中文     | 定义                                                                          |
| ------------ | ------------------------- | -------- | ----------------------------------------------------------------------------- |
| **邻域**     | neighborhood / ranked set | 邻域     | 按符合度排序的**相关 MemoryItem 集合**；告知总数 N；首屏默认 ≤5；可 Show more |
| **邻域命中** | neighborhood hit          | 邻域命中 | 用户认定目标出现在排序池（含续展）内；**会话履约主尺**                        |
| **头名命中** | top-1 hit                 | 头名命中 | Top Pick 即用户目标；**delight 指标**，非唯一 KPI                             |
| **排序池**   | ranked pool               | 排序池   | `topPick` + `alsoPossible`；`totalRankedCount` = 互异组总数                   |

**禁止：** 把邻域命中说成失败；把头名未中当成产品失败。

### 5.2 Outcome（结果形态）

| Outcome       | 英文 UI                         | 中文              | 含义                                      |
| ------------- | ------------------------------- | ----------------- | ----------------------------------------- |
| `top_pick`    | Top pick / suggestion           | 高置信建议 / 头名 | 有建议首项 + 邻域列表；**建议非神谕**     |
| `need_a_clue` | Need a clue / Add one more clue | 需补线索 / 弱命中 | 有弱候选但把握不够；请 refine clue 或否定 |
| `no_match`    | No match                        | 无命中            | 库里无对上痕迹；**诚实终局**              |

| 子类               | 英文                | 含义                 |
| ------------------ | ------------------- | -------------------- |
| `constrained_none` | constrained empty   | 强约束下库内确无痕迹 |
| `unconstrained`    | unconstrained empty | 约束不足或无法判定   |

### 5.3 结果结构

| 概念              | 英文                      | 中文            | 定义                                                   |
| ----------------- | ------------------------- | --------------- | ------------------------------------------------------ |
| **Top Pick**      | `topPick`                 | 头名 / 建议首项 | 排序第一的代表项；UI 作建议展示                        |
| **Also Possible** | `alsoPossible`            | 其余候选        | 除头名外排序池中的项                                   |
| **相关猜测**      | `relatedGuess`            | 相关猜测        | `no_match` 时可选的「你可能记错成」同类项；非 Top Pick |
| **命中项**        | `RecallMatch`             | 命中项          | 单条结果：`item` + `score` + `matchedFields`           |
| **折叠组**        | `duplicateGroup` / stacks | 折叠 / 叠放     | 同键多条在**结果层**折叠；`stacks N` = 同键组员数      |
| **证据**          | evidence                  | 证据            | 可验证来源单元；须满足 ECS 五要素（见产品文档 §0.3）   |
| **命中解释**      | `explainRecallMatch`      | 命中理由        | 主因字段 + token；Explain 层                           |

### 5.4 会话与表述

| 概念                | 英文                | 中文       | 定义                                                     |
| ------------------- | ------------------- | ---------- | -------------------------------------------------------- |
| **Recall composer** | Recall composer     | 找回输入区 | Side Panel / Omnibox 中输入 clue 的 UI                   |
| **追问**            | follow-up           | 追问       | 仅服务 Recall；补 clue、在候选内收窄                     |
| **追问芯片**        | suggestion chip     | 芯片       | `need_a_clue` 时可点的收窄建议；`value` 用英文 canonical |
| **Recall Framing**  | recall framing      | 邻域表述   | 助手气泡：听懂什么、为何有此列表、把握度                 |
| **助手跟进**        | `assistantFollowUp` | 助手跟进   | `need_a_clue` 的 NLG 文案 + 芯片                         |

**两种找回意图（开发讨论）：**

| 意图         | 中文        | 期望           |
| ------------ | ----------- | -------------- |
| **钉死一条** | 找特定那条  | 目标进 top-3   |
| **逛一簇**   | 看一类/一批 | 邻域含目标即可 |

### 5.5 Detail export（详情导出）

| 概念              | 英文                        | 中文     | 定义                                                                                                                                               |
| ----------------- | --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Detail export** | detail export               | 详情导出 | Library / Recall 多选 MemoryItem → **复制**或**下载**带来源的 Markdown/JSON；至少 1 条；**不预设**下游用途；**禁止**整库 dump（§5.10.4 · ADR-008） |
| ~~Evidence pack~~ | evidence pack（deprecated） | 旧称     | 仅协议/MCP 历史文档；产品面改用 **Detail export**                                                                                                  |

**与 ECS「证据」区分：** Detail export 是**功能名**；**证据**（evidence）仍是 Explain 层可验证单元（§5.3）。

---

## 6. 理解与 AI 边界

| 概念               | 英文                         | 中文            | 定义                                               |
| ------------------ | ---------------------------- | --------------- | -------------------------------------------------- |
| **理解层**         | understanding layer          | 理解层          | clue → 结构化约束；LLM 默认，规则降级              |
| **Enrichment**     | enrichment                   | 富化 / 线索增强 | Capture 后补 `tags`/`keywords` 等，服务日后 Recall |
| **Hybrid**         | hybrid recall                | 混合召回        | 关键词 Filter +（可选）embedding 近邻              |
| **数据平面**       | data plane                   | 数据平面        | 确定性读写 IndexedDB；**LLM 禁止直连**             |
| **提议→校验→执行** | propose → validate → execute | 提议门禁执行    | LLM 只出提议；Zod/门禁后由确定性代码执行           |

**线索类别（理解目标，非用户必填槽位）：**

1. **内容线索** — 对象类型、作者、主题、实体
2. **行为线索** — 保存过、打开过、看了一半
3. **时间线索** — yesterday、last week、recent

---

## 7. 语言与 Canonical

| 层                   | 职责                                                  | 语言                   |
| -------------------- | ----------------------------------------------------- | ---------------------- |
| **UI 展示**          | 扩展、官网、空态、追问                                | 仅 en（美式英语）      |
| **用户输入（clue）** | Recall composer                                       | 目标美式英语口语       |
| **内部 canonical**   | `tags`/`keywords`/`entities`、parser 槽位、芯片填入值 | 统一 English canonical |

**产品判断：** 用户发起 Recall 时，更多是在复述**记忆对象**，而不是复述**原始文本**。

---

## 8. 指标（开发 / 产品讨论）

| 概念                   | 英文                        | 定义                                     |
| ---------------------- | --------------------------- | ---------------------------------------- |
| **Verified Retrieval** | verified retrieval          | 用户打开来源/原文/副本确认找回成功       |
| **TTE-V**              | time-to-evidence (verified) | 提交 clue → 首次看见可自验证据单元的时间 |
| **会话成功**           | session success             | 用户在邻域（含续展）拿到想要的           |

---

## 9. 禁用与慎用对照表

| 禁用/慎用          | 应改用                       | 场景                   |
| ------------------ | ---------------------------- | ---------------------- |
| Search / 搜索      | Recall / find                | 一切用户可见文案       |
| query（产品名词）  | clue                         | 描述用户输入           |
| prompt（产品名词） | clue / understanding         | 非 LLM 实现讨论        |
| 笔记（指附注时）   | note / 附注 / `clues.note`   | 避免与 `note` 类型混淆 |
| 知识库             | library / your saves         | 对外心智               |
| 助理 / 聊天        | Recall / find what you saved | 品类定位               |
| 唯一答案 / 押中    | neighborhood / suggestion    | 体验承诺               |
| 输入（作领域名）   | clue                         | 领域讨论               |
| 筛选（对用户）     | find / recall                | 用户面；Filter 仅对内  |

---

## 10. 代码与消息锚点（速查）

| 概念     | 主要锚点                                                   |
| -------- | ---------------------------------------------------------- |
| 用户线索 | `clue` · `RECALL_WITH_CLUE` · `parseRecallClue`            |
| 条目     | `MemoryItem` · `indexedDBManager`                          |
| 附注     | `clues.note` · `UPDATE_MEMORY_NOTE`                        |
| Outcome  | `RecallOutcome`: `top_pick` \| `need_a_clue` \| `no_match` |
| 折叠键   | `getMemoryFoldKey` · `derive-memory-duplicate-key.ts`      |
| i18n     | `popup_clue_*` · `t()` · `_locales/en/messages.json`       |

### 10.1 遥测事件（TTE 七事件）

| 事件 `type`        | 用户动作（术语）     | 说明            |
| ------------------ | -------------------- | --------------- |
| `clue_submitted`   | 提交 clue            | t0；TTE-V 起点  |
| `clue_refined`     | refine clue / 补线索 | 多轮收窄；计 IB |
| `result_rendered`  | 邻域结果渲染         | —               |
| `evidence_visible` | 证据单元可见         | ECS 达标停表    |
| `source_opened`    | 打开来源             | —               |
| `user_confirmed`   | 用户确认找回         | —               |
| `task_timeout`     | 任务超时             | 180s 右删失     |

**读取迁移：** 本机 `yiveno.recallTelemetry` 中旧版 `query_submitted` / `query_refined` 在 `recall-telemetry-store` 读取时自动映射为 `clue_*`。

### 10.2 Filter / Embedding 实现标识符

| 标识符                                         | 含义                                         |
| ---------------------------------------------- | -------------------------------------------- |
| `buildFilterClueFromParsed`                    | 从 `ParsedRecallClue` 拼 **Filter 检索词面** |
| `filterClue`                                   | 传入 `keyword-filter` / 倒排 lookup 的字符串 |
| `buildClueEmbeddingText` / `clueEmbeddingText` | 拼 **embedding 请求**文本                    |
| `collectFilterIndexFields`                     | 收集条目可索引字段（供 Filter / 倒排）       |
| `clueSubmittedAt`                              | 遥测任务 t0 时间戳（`beginClue`）            |
| `beginClue`                                    | Side Panel 提交 clue 时开启 TTE 任务         |
| `recall-shell-empty-copy`                      | Recall 壳空态 / no_match 文案纯函数模块      |
| `RecallShellLibraryState`                      | Recall 壳侧记忆库空/就绪状态                 |
| `shouldShowCaptureFirstRecallShell`            | 安装引导 Capture-first 空态门禁              |
| `popup_clue_*` / `popup_*`（i18n）             | **遗留 i18n key 前缀**（语义为 clue / 空态） |
| `URLSearchParams` / `location.search`          | URL 查询参数（与 Recall clue 无关）          |

---

## 11. 维护纪律

1. **新增概念**或**改变叫法** → 必须先入本文，再改代码/其它文档。
2. **产品文档**写行为细节时可引用本文词条，**不得**在其它文档重复定义同一概念而不同义。
3. **PR / 测试语料 / MCP 步骤** 描述用户动作时用 **clue**，描述存侧用 **Capture**，描述找侧用 **Recall**。
4. **代码注释（开发者面）**：`clues.note` 写 **附注**，不写「备注/笔记」；用户 Recall 输入写 **clue/线索**。
5. **eval 夹具** 字段名保持 `clue`（见 `recall-eval`）。
6. 与本文冲突的旧表述：以**本文 + 产品文档 Normative** 对齐后删除旧说法。

---

## 12. 相关文档

| 文档                                            | 关系                               |
| ----------------------------------------------- | ---------------------------------- |
| `Yiveno-产品文档-v4.0.md`                       | 行为/契约/验收；术语含义以本文为准 |
| `Yiveno-设计标准-v1.md`                         | 视觉；术语引用本文                 |
| `.cursor/rules/terminology.mdc`                 | AI 协作速查；指向本文              |
| `docs/engineering/Recall-Framing-邻域说明.md`   | Recall Framing 工程细则            |
| `docs/architecture/Yiveno-运行时架构流程-v1.md` | 运行时流程；术语服从本文           |

---

_最后更新：2026-08-28 · 初版落盘_
