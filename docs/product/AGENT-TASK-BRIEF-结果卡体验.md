---
created: 2026-11-02T11:59:31+0800
updated: 2026-11-02T12:19:54+0800
author: agent:cursor
scope: Recall 结果卡体验波次（扫读层级 / 交互热区 / 合规动效 / 先卡后 Framing）；暂停召回排序优化
status: complete
upstream:
  - 维护者会话（2026-11-02）：结果卡=Recall 结果态核心组件；便捷+可读优先
  - docs/product/Yiveno-产品文档-v4.0.md §0.1.1 / §3 / §5.10.1 / §7.0
  - docs/design/Yiveno-设计标准-v1.md §5.3–5.4
downstream:
  - extension/src/pages/sidepanel/RecallResultCard.vue
  - extension/src/pages/sidepanel/components/RecallConversation.vue
  - docs/product/CURRENT.md
---

# Task Brief · Recall 结果卡体验

### Scope

- **In：** `RecallResultCard` 扫读层级 / Top Pick **视觉**略强调 / 集合展开与邻域入场动效；`RecallConversation` 列表节奏；权威文档与 CURRENT 同步
- **Out：** 不改 Filter / Hybrid / 佐证门 / must 扩面 / 召回排序；不加 Projects/Artifacts/图谱；不加神谕文案（「most likely」等）；不做卡上工具条堆砌

### 双线程五问

- **01 用户问题：** 邻域结果是否一眼可读、点得爽、出现时不突兀？
- **02 能观察到什么：** 扫读时间 / 打开出处步骤 / 入场是否可感（明线体验）
- **03 可证伪假设：** 无；仅明线
- **04 证据如何改善产品：** N/A
- **05 结论如何可靠：** N/A
- **出口：** 仅明线

### 优先级

1. **扫读层级** — 摘录：正文后立刻出处（页名·domain）；Top Pick 仅加强描边/阴影（禁止判决文案）；reason 对比度略提
2. **入场/展开节奏** — 邻域列表短淡入 stagger；集合 sibling 短淡入；`prefers-reduced-motion` 关闭
3. **次要交互** — 摘录卡右下角「打开原文」（`sourceUrl` 新标签）；主热区仍整卡进详情；不做工具条堆砌
4. **结果态节奏** — 有卡：`Heard as` → 邻域卡 → Framing；无卡：文案仍居上

### 验收

- 摘录卡：正文下方可见出处行（先于 reason）；时间可与出处同行
- Top Pick：视觉可辨于次卡；**无**「就是它 / most likely」类文案
- 结果出现有短淡入；reduced-motion 下无动画
- 摘录卡可见「打开原文」；点后新标签开源站（主点仍进 detail）
- 有邻域时 a11y/DOM：卡出现在 Framing 长文之前
- 相关单测绿；`cd extension && bun run build`；MCP Side Panel 抽测 ≥1 条含摘录卡

### 禁止

- 用体验冒充 §5.9；hover/focus 几何变换；内容别名灰名单；改召回算法
