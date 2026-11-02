---
created: 2026-11-02T10:13:40+08:00
updated: 2026-11-02T12:50:00+08:00
author: agent:cursor
scope: 用户可见展示 vs 契约/传输字面的产品体验分面原则（长期权威）
status: normative-principles
upstream:
  - 维护者会话（2026-11-02）：composer URL 芯片与 placeholder 可读性；可见≠传输
  - docs/product/Yiveno-产品文档-v4.0.md §0 / §3 / §7.0
  - docs/product/Yiveno-术语表.md
downstream:
  - docs/product/Yiveno-产品文档-v4.0.md §0.1.3（短锚）
  - docs/product/Yiveno-术语表.md（可见面 / 契约面）
  - extension/src/core/recall/clue-plain-url.ts（formatCluePlainForUserDisplay）
  - extension/src/core/recall/clue-url-display.ts
  - .cursor/rules/project.mdc（改动面 → 本文）
---

# Yiveno 可见与契约分面 · 体验原则

> **地位：** 产品体验的**长期权威原则**。产品文档 §0.1.3 为短锚；具体交互仍以产品文档 §0–§7 为准。  
> **不是：** 新 UI 组件清单；不是「处处做芯片」；不是改召回算法的借口。  
> **冲突时：** 行为/验收仍以产品文档 Normative 为准；**展示 vs 传输**的纪律以本文为准，并回写产品文档相关段。

---

## 0. 一句话

**用户看得见的信息**与**用户看不见、但系统当真的信息**，是两套准则：可见面优化可读与信任；契约面保持完整、可复现、可对拍。禁止用展示缩短污染传输，也禁止把契约原串直接甩进密集 UI 冒充体验。

---

## 1. 两面定义

| 面         | 英文锚                       | 是什么                                                                                                                                                           | 优化目标                                             |
| ---------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **可见面** | user-visible / display plane | 人眼/读屏在 UI 上直接感知的文案、标签、芯片、placeholder、卡片副文、Omnibox 描述等                                                                               | 可读、短、有温度；URL 等机器串不抢注意力             |
| **契约面** | contract / wire plane        | 消息 payload、IndexedDB 字段、会话 `priorUserUtterances`、Filter/embedding 输入、遥测原文、导航 `href`、a11y 需要完整真相时的 `aria-label`/`title`（完整 URL）等 | 完整、稳定、可日志/可 eval；禁止「展示好看了就改库」 |

**同对象可双份：** 例如 clue 含 URL——composer/气泡**可见**为芯片或缩短 host/path；`RECALL_WITH_CLUE.clue` 与用户气泡序列化**契约**仍为完整 `https://…` 纯字符串。

---

## 2. 硬规则

```
❌ 禁止：为 UI 好看改掉写入 IndexedDB / 发出的 message / prior utterances 字面
❌ 禁止：用展示缩短串去做 Filter、embedding、折叠键、eval 金标对拍
❌ 禁止：可见面堆完整长 URL / 机器 id 当主文案（除非该控件的工作就是出示完整 URL）
❌ 禁止：placeholder / 顶栏标题等「提示层」做成可点 URL 芯片（抢输入焦点；见产品文档 §7.0）
❌ 禁止：把「可见面做得像通解」却在契约面偷内容别名灰名单（仍受全量用户通解铁律约束）
✅ 默认：可见面 = 派生展示（芯片 / host·path / 库内标题）；契约面 = 权威字面
✅ 默认：悬停 `title` 与导航 `href` 用完整 URL；芯片主文案用标题或缩短 host/path
✅ 允许：a11y `aria-label` 在「操作名」场景用完整真相（如完整 URL）；与可见短标签并存
✅ 允许：CSS ellipsis 做布局截断；病态超长另设安全上限——二者都不改契约字面
```

---

## 3. URL / 链接（首发样板）

| 场景                                                 | 可见面                                                                                                       | 契约面                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Composer（粘贴 / blur / 发送后）                     | 原子芯片（favicon + 标题或缩短 host/path）；**键入过程保持纯文本、不 live 格式化**；可见长度门禁 tip（≤500） | `serialize` → 完整 http(s)；契约 `clue.max=500`                     |
| 用户气泡                                             | 同形芯片渲染                                                                                                 | 回合 `text` 仍为完整纯字符串                                        |
| 会话标题 / placeholder 点名 / 续找 status / 软岔路口 | `formatCluePlainForUserDisplay`（URL→host/path；**非**芯片）                                                 | `resolveThreadFindTitle` / prior utterances 完整字面；a11y 可用完整 |
| 证据卡副文                                           | domain / 出处短标签                                                                                          | `card.url` 导航用完整 href                                          |
| Omnibox 描述                                         | 已缩短 host 等展示字段                                                                                       | 打开 / handoff 仍用完整 URL                                         |
| 听写 / 粘贴 / 提交                                   | —                                                                                                            | model 与 `RECALL_WITH_CLUE` 完整纯字符串                            |

**实现锚点：**

- 缩短 / 标题标签：`extension/src/core/recall/clue-url-display.ts`
- 纯文本切分 + 可见缩短：`extension/src/core/recall/clue-plain-url.ts`（`formatCluePlainForUserDisplay`）
- Composer DOM 芯片：`extension/src/pages/sidepanel/composer/*`

---

## 4. Recall 核心流程 · 首波核查表（2026-11-02）

> 状态：✅ 已对齐 · ⚠️ 部分/跟进 · ⬚ 未开（非本波）

| #   | 表面                          | 可见面期望                                      | 契约面期望                     | 状态                      |
| --- | ----------------------------- | ----------------------------------------------- | ------------------------------ | ------------------------- |
| R1  | Composer contenteditable      | URL 芯片；悬停完整 URL                          | 提交纯字符串完整 URL           | ✅                        |
| R2  | 用户气泡                      | 同形芯片                                        | `turn.text` 完整字面           | ✅                        |
| R3  | Placeholder 点名会话标题      | URL 缩短进「围绕「…」」句                       | prior / title 字面完整         | ✅                        |
| R4  | 顶栏会话标题                  | 缩短 URL 展示                                   | a11y 可用完整字面              | ✅                        |
| R5  | 续找 contextStatus / 软岔路口 | 缩短 URL 展示                                   | 会话字面完整                   | ✅                        |
| R6  | 证据卡标题/副文/打开/为何贴合 | 标题·domain；reason 插值缩短 URL；打开完整 href | MemoryItem URL / clue 字面不变 | ✅                        |
| R7  | Omnibox 建议描述              | 短 host/标题                                    | 导航完整 URL                   | ✅（既有）                |
| R8  | Heard as / Framing 正文       | 槽位芯片；不嵌完整长 URL 当主句                 | parsed / Filter 字面完整       | ✅（既有；无 URL 主路径） |
| R9  | 可见进展等待文案              | 不回显完整长 clue URL                           | 遥测可用 preview 截断          | ✅（既有）                |

### 4.1 Library / Detail / Settings · 第二波核查表（2026-11-02）

| #   | 表面                                 | 可见面期望                                           | 契约面期望                       | 状态                |
| --- | ------------------------------------ | ---------------------------------------------------- | -------------------------------- | ------------------- |
| L1  | Library 书签树主标题                 | 人读标题原样；标题若为 URL → host/path；悬停完整 URL | Chrome/Memory title·url 字面不变 | ✅                  |
| L2  | Library 书签副文                     | domain                                               | href 导航完整                    | ✅（既有）          |
| L3  | Library 摘录列表                     | 正文 + 出处（页名·domain）                           | sourceUrl / href 完整            | ✅（既有）          |
| L4  | Detail 摘录页                        | pageTitle + domain；打开源按钮文案非裸 URL           | sourceUrl href 完整              | ✅（既有）          |
| L5  | Recall/库共用 `getMemoryItemDisplay` | 书签 URL 标题缩短                                    | payload 不变                     | ✅                  |
| S1  | Settings 隐私/条款行                 | 本地化动作文案；href 外链                            | URL 常量完整                     | ✅（既有 · 无缺口） |

### 4.2 官网营销 / GEO · 第三波核查表（2026-11-02）

> **官网契约面含义：** `href` / `canonical` / JSON-LD `url` / `sitemap` / `llms.txt` 绝对 URL；FAQ **JSON-LD 与英文 `FAQ_ENTRIES` 同源**（可见 zh 文案可分面，见 `Yiveno-官网GEO.md`）。  
> **可见面：** 人读营销文案、CTA 标签、演示 mock；**禁止**把商店深链 / 长绝对 URL 当主按钮文案。  
> **与 GEO：** [`Yiveno-官网GEO.md`](../engineering/Yiveno-官网GEO.md) — 可见事实 ↔ schema / `llms.txt` 一致；完整 URL 属 agent/爬虫契约，不是 UI 装饰。

| #   | 表面                          | 可见面期望                                                | 契约面期望                                                      | 状态                |
| --- | ----------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- | ------------------- |
| W1  | 安装 CTA（`InstallCta`）      | 人读店名标签（Get for Chrome / Edge）；未上架 Coming soon | `EDGE_*` / `CHROME_*` listing **完整** URL 进 `href`（空=无链） | ✅（既有 · 无缺口） |
| W2  | 首页流程 / Recall mock        | 人读标题与口语 clue；浏览器栏装饰非裸 URL 文案            | 无 Filter/库契约；演示字面仅营销                                | ✅（既有 · 无缺口） |
| W3  | FAQ 可见 Q&A                  | 人读问答；无堆长 https 主句                               | `FAQ_ENTRIES` = 正文 + `FAQPage` JSON-LD 同源                   | ✅（既有 · 无缺口） |
| W4  | 首页 JSON-LD / OG / canonical | meta 短描述                                               | `CANONICAL_ORIGIN` 绝对 URL；Offer 无假 InStock                 | ✅（既有 · 无缺口） |
| W5  | `llms.txt` / sitemap / robots | （agent 读）                                              | 绝对 canonical 页列表；与公开路由一致                           | ✅（既有 · 无缺口） |
| W6  | Support / Privacy / Terms 链  | 动作/页名或联系邮箱（控件职责即出示联系方式）             | `mailto:` / 站内 path / 绝对外链完整                            | ✅（既有 · 无缺口） |

**本波不做：** 官网营销大段重写；不把 Library 行做成 URL 芯片；不把 `llms.txt` 绝对 URL「缩短」进 UI。

---

## 5. 设计自检（改 UI 前）

1. 用户**看见**的字符串，是否可以是派生展示？若必须完整 URL，是否放在 `title` / 详情而不是主文案？
2. 发出去 / 存下来的字符串，是否仍是权威字面？拿掉展示层后 eval / 日志能否对拍？
3. 是否误把展示缩短写进 Filter / embedding / 折叠键？
4. a11y：短标签 + 完整 `aria-label`/`title` 是否成对？
5. 是否用芯片解决「提示层」问题？（通常否——placeholder 用缩短纯文本。）

---

## 6. 与其它权威的关系

| 文档                       | 关系                                                                      |
| -------------------------- | ------------------------------------------------------------------------- |
| `Yiveno-产品文档-v4.0.md`  | 行为/验收；§0.1.3 短锚本文；§7.0 composer / 会话标题引用分面              |
| `Yiveno-术语表.md`         | 「可见面 / 契约面」词条                                                   |
| `Yiveno-设计标准-v1.md`    | 视觉气质；**不**定义传输字面（其「分面」指官网/扩展字体面，勿与本文混淆） |
| `Yiveno-双线程发展原则.md` | 明线体验纪律可引用本文；暗线研究不得要求改契约字面                        |
| `Yiveno-官网GEO.md`        | 官网可见事实 ↔ schema/`llms.txt`；绝对 URL 属契约/agent 面（§4.2）        |

---

## 7. 修订

| 日期       | 变更                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| 2026-11-02 | 第三波：官网营销/GEO W1–W6 核查（无代码缺口）；原则 §4.2；GEO 文档交叉锚                              |
| 2026-11-02 | 第二波：Library 书签 URL 标题可见缩短（`formatSavedTitleForUserDisplay`）；Settings/Detail 核查无缺口 |
| 2026-11-02 | 初版：可见/契约两面硬规则；URL 样板；Recall 核心首波核查表                                            |
