---
created: 2026-09-17T16:30:00+08:00
updated: 2026-09-17T16:30:00+08:00
author: agent:cursor
scope: Yiveno 项目 AI Agent 入门上下文
status: active
upstream:
  - docs/product/Yiveno-产品文档-v4.0.md
  - docs/product/Yiveno-术语表.md
  - docs/product/CURRENT.md
  - docs/architecture/decisions/
  - .cursor/rules/project.mdc
downstream:
  - 所有 AI Agent 会话（第一读取文件）
---

# Yiveno AI Context

> **新 Agent 会话第一读取文件。**
>
> 本文件是 Yiveno 项目的「入门指南」——让 AI Agent 在 5 分钟内理解：
>
> - Yiveno 是什么
> - 当前在做什么
> - 绝对不能做什么
> - 核心架构是什么
>
> **权威来源：** 如有冲突，以下文件优先于本文件：
>
> - `docs/product/Yiveno-产品文档-v4.0.md`（产品行为 Normative）
> - `docs/product/Yiveno-术语表.md`（术语权威）
> - `docs/product/CURRENT.md`（当前焦点）
> - `.cursor/rules/project.mdc`（项目硬规则）

---

## 1. What is Yiveno?

**一句话定义：**

> Yiveno = **那个找东西的** / find things
>
> 帮用户用模糊的口语线索找回自己主动存过的个人痕迹（摘录 + 附注）；书签是配角。

**核心体验：**

- **Capture（保存）：** 划词保存 + Chrome 书签同步
- **Recall（找回）：** 输入口语线索 → 获得排序邻域（不是唯一答案）

**用户输入叫什么：** **clue**（线索）

- ❌ 不要叫 query / search / prompt / question
- ✅ 叫 clue / recall clue

**禁止对外承诺：**

- 「每次押中唯一正确答案」
- 「全知助理」
- 「人生记忆产品」（除非明确启用）

---

## 2. Core Philosophy

### 2.1 定位铁律

| 做什么                             | 不做什么                           |
| ---------------------------------- | ---------------------------------- |
| Capture 低负担 + Recall 高置信邻域 | 书签管理器 / 笔记工具 / 聊天机器人 |
| 邻域集合交付（Top Pick = 建议）    | 神谕唯一答案                       |
| LLM 做理解/NLG，不碰数据平面       | LLM 直接操作 IndexedDB             |
| IndexedDB 是事实源                 | 把 LLM 输出当事实                  |
| 个人痕迹（摘录 + 附注）是核心资产  | 纯书签搜索                         |

### 2.2 产品心智（ADR-012）

**当前对外句：** _Find what you saved._

**Things 双关：**

- 表层：书签/摘录/文件
- 深层：记忆/喜好（可选后手，视发展再定）

**定位句不变；双关/翻牌 = 后手，可以 ≠ 必须。**

### 2.3 终局壁垒

不是「Search → Memory」品类跳跃。
终局壁垒 = **不愿迁走的私有增量 + 习惯 + 信任**。

---

## 3. Current Product State

### 3.1 能力真相

**已上线（§1）：**

- Side Panel Recall 主壳
- Hybrid 召回（关键词 + embedding + RRF）
- 倒排索引 Phase 1
- ECS 结果卡面
- Detail export
- 只读 MCP beta
- Raindrop/Pocket 导入
- TTE 本机埋点
- Dodo Pro 门禁

**Beta 门槛（未达）：**

- §5.9 Beta：TTE-V P50 ≤ 12s / Success@180 ≥ 75% / ECS ≥ 92%
- **无种子 study 数据前不得对外宣称 Beta 达标**

**MCP：**

- **不对用户主宣传**
- 未达 §5.9 门槛前不扩 MCP 对外宣传

### 3.2 当前焦点（CURRENT.md）

| 优先级     | 任务                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| **主线**   | §5.9 种子验证 + Recall 质量闭环                                              |
| **并行**   | Getting Started 书签首召；Recall 可见进展；Idle 口语范式；ADR-011 时间置信度 |
| **进行中** | 自然 clue 采样；理解回声；冷启动放行后轻条；recall-eval must                 |

详见 `docs/product/CURRENT.md`

---

## 4. Architecture Summary

### 4.1 分层架构（单向依赖）

```
pages/ (Vue UI)
    ↓
application/ (服务编排)
    ↓
core/ (纯 TS / Zod / 无 Chrome / 无 IDB)
    ↓
infrastructure/ (Chrome API / IndexedDB / i18n)
    ↓
background/ (Service Worker)
```

### 4.2 硬约束

| 约束                | 规则                                                   |
| ------------------- | ------------------------------------------------------ |
| UI 不直连 IndexedDB | 必须经 `background-client.ts`                          |
| Chrome API 调用     | 只能在 `background/` 或 `infrastructure/browser/`      |
| IndexedDB 唯一入口  | `indexedDBManager`                                     |
| 新 message type     | 先改 `core/messaging/` → handler → registry → 产品文档 |
| LLM 数据边界        | LLM 只出提议 → Zod 门禁 → 确定性代码执行               |

### 4.3 Recall 链路

```
clue → 理解层（LLM 或规则）→ 候选加载（倒排预过滤）→ Hybrid 融合（关键词 + embedding + RRF）→ 佐证门 → 结果构建 → Framing → 结果卡
```

### 4.4 关键路径

| 功能           | 入口                                     |
| -------------- | ---------------------------------------- |
| 用户 clue 输入 | `RECALL_WITH_CLUE` → `recall-handler.ts` |
| Recall 主逻辑  | `HybridRecallBackend.recallWithClue`     |
| 关键词打分     | `core/recall/keyword-filter.ts`          |
| Hybrid 融合    | `core/recall/hybrid-fusion.ts`           |
| 结果构建       | `core/recall/build-recall-result.ts`     |
| IndexedDB      | `infrastructure/indexeddb/manager.ts`    |

---

## 5. Non-negotiable Rules

### 5.1 LLM 边界（ADR-004）

- ❌ LLM 不直接读写 IndexedDB
- ❌ LLM 不决定 final outcome
- ✅ 所有 LLM 输出经 Zod schema 门禁
- ✅ 数据平面只做「提议 → 门禁 → 执行」

### 5.2 禁止灰名单通解（ADR-005）

- ❌ 硬编码别名表冒充全用户通解
- ✅ 用通用算法（CamelCase / 多词首字母 / 折叠键）
- ✅ 残差诚实留给字面/Hybrid

### 5.3 术语纪律（ADR-002 / 术语表）

| 场景     | 正确             | 禁止                    |
| -------- | ---------------- | ----------------------- |
| 用户输入 | clue             | query / search / prompt |
| 结果     | 邻域 / Top Pick  | 唯一答案 / 押中         |
| 筛选     | Filter（仅对内） | 对用户说 Filter         |

### 5.4 文档同步铁律

代码改动必须同步文档：

| 改动            | 必须同步                                             |
| --------------- | ---------------------------------------------------- |
| 术语/概念       | `docs/product/Yiveno-术语表.md`                      |
| 产品行为        | `docs/product/Yiveno-产品文档-v4.0.md`               |
| 架构/消息协议   | ADR + 产品文档                                       |
| 视觉/品牌       | `docs/design/Yiveno-设计标准-v1.md`                  |
| 新 message type | `docs/engineering/background-message-types.registry` |

---

## 6. Current Priorities

### 6.1 主线（必须做）

**§5.9 种子验证 + Recall 质量闭环：**

- 自然 clue 采样协议
- recall-eval must 增补
- Outcome Labeling §7.2
- TTE 种子研究

### 6.2 并行（高优）

| 任务                     | 说明                          |
| ------------------------ | ----------------------------- |
| Getting Started 书签首召 | §5.8 双源 tab + LLM 示意 clue |
| Recall 可见进展          | §7.0 A/B 度量                 |
| 理解回声                 | 结果态 `Heard as` 芯片        |
| Idle 口语范式            | 库 ready 空态可点样句         |
| 冷启动放行后轻条         | §5.8.1 顶栏非阻挡提示         |
| ADR-011 时间置信度       | high 硬筛 / low 软排          |
| 内容佐证门               | `contentTerms` 须词面佐证     |

### 6.3 本周不做

| 任务                            | 原因           |
| ------------------------------- | -------------- |
| 新连接器 / Agent / history 抓取 | 未达 §5.9 门槛 |
| MCP 对外宣传                    | Beta 未达标    |
| 内容别名灰名单                  | 违反 ADR-005   |
| Side Panel 持久多会话           | 产品边界       |
| 把 CWS 上架当 §5.9 验收         | 命题先验       |

---

## 7. Forbidden Directions

### 7.1 绝对禁止

1. **把邻域命中说成失败** / 把头名未中说成产品失败
2. **用硬编码别名表冒充语义通解**
3. **对外承诺「每次押中唯一答案」**
4. **在 core/ 中引入 Chrome API 或 IndexedDB**
5. **UI 直连 IndexedDB**（绕过 `background-client.ts`）
6. **产品文案用中文**（扩展 UI / 官网 / 对外 slogan）
7. **把用户输入叫 query / search / prompt**
8. **LLM 直接操作数据平面**
9. **擅自 git commit / push**
10. **用 git checkout/restore/reset --hard 丢弃 WIP**

### 7.2 产品边界（不要越界）

- 不做 Notion clone
- 不做个人助理/偏好记忆
- 不做知识图谱 UI
- 不做聊天机器人主路径
- 不做书签自动整理

---

## 8. Key Files Quick Reference

### 8.1 必读文件

| 文件                                      | 用途           |
| ----------------------------------------- | -------------- |
| `docs/product/CURRENT.md`                 | 当前焦点       |
| `docs/product/Yiveno-术语表.md`           | 术语定义       |
| `docs/product/Yiveno-产品文档-v4.0.md` §0 | Quick Contract |
| `docs/architecture/decisions/`            | ADR 索引       |

### 8.2 核心代码路径

| 功能            | 文件                                                                 |
| --------------- | -------------------------------------------------------------------- |
| Recall 主壳     | `extension/src/pages/sidepanel/`                                     |
| Recall 主逻辑   | `extension/src/application/recall/backends/hybrid-recall-backend.ts` |
| 关键词打分      | `extension/src/core/recall/keyword-filter.ts`                        |
| Hybrid 融合     | `extension/src/core/recall/hybrid-fusion.ts`                         |
| 结果构建        | `extension/src/core/recall/build-recall-result.ts`                   |
| Message schema  | `extension/src/core/messaging/`                                      |
| IndexedDB       | `extension/src/infrastructure/indexeddb/`                            |
| Message handler | `extension/src/background/handlers/message-handler.ts`               |

### 8.3 i18n

所有产品文案：**仅英文**，经 `t()` + `_locales/en/messages.json`

---

## 9. Maintenance Rules

### 9.1 文档同步

- **改代码前先看文档**
- **改代码后同步文档**
- **禁止「代码改了、文档没改」**

### 9.2 术语纪律

- 首次出现核心概念时括号标注英文
- 产品面严格用 clue / Recall / library
- 代码注释用中文

### 9.3 测试要求

| 改动类型                | 验证方式             |
| ----------------------- | -------------------- |
| Recall/Capture 用户可感 | MCP 真机 UI 路径 ≥ 1 |
| 核心业务逻辑            | 单测                 |
| 行为变更                | recall-eval must     |

---

## 10. Related Documents

| 文档                                   | 关系                |
| -------------------------------------- | ------------------- |
| `docs/product/CURRENT.md`              | 当下焦点唯一手写源  |
| `docs/product/Yiveno-术语表.md`        | 术语唯一权威        |
| `docs/product/Yiveno-产品文档-v4.0.md` | 产品行为 Normative  |
| `docs/architecture/decisions/`         | ADR（不可重议决策） |
| `docs/design/Yiveno-设计标准-v1.md`    | 视觉规范            |
| `docs/README.md`                       | docs/ 目录入口      |
| `.cursor/rules/project.mdc`            | 项目硬规则          |

---

_Last updated: 2026-09-17_
