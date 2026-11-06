# Task Brief · ADR-021 波次 1 · 在线默认标清

> **状态：** 已完成（2026-11-07 验收）  
> **前置：** ADR-021 / §0.1.4 / CURRENT 冻结已落盘  
> **后续：** 波次 2 见 `AGENT-TASK-BRIEF-ADR-021-波次2-本机快跳标识.md`  
> **验收记录：** 产品文档 §0.1.4 / ADR-007 叙事为「本机快跳」；仓内生产 TS 无「Omnibox=离线产品」误导句

---

```text
## Task Brief

### Scope
- **In：**
  - 产品文档 / ADR-007 / 工程手测：把「Omnibox 离线快跳」叙事改为「本机快跳」（延迟·成本分轨；非离线产品）
  - 扩展关键注释与 flow log 文案：对齐 ADR-021（理解层主路径=在线 LLM；规则=降级/lexical；Side Panel offline=薄适配）
  - 本 Brief 落盘于 `docs/product/`
- **Out：**
  - 不改用户可见 i18n / CSS class / UI 布局
  - 不重命名 `omnibox_offline` 遥测 mode 字面（波次 2）
  - 不合并 Hybrid / omit-LLM 分叉实现（波次 2+；须另 Brief）
  - 不加深离线壳；不碰召回质量调参 / must 扩面

### 双线程五问
- **01 用户问题：** 找东西要不要按「断网也能爽用」排期？
- **02 能观察到什么：** 文档与日志是否还在把 Omnibox/规则讲成离线产品
- **03 可证伪假设：** 无；仅明线防 scope 漂移
- **04 证据如何改善产品：** N/A
- **05 结论如何可靠：** Normative 对照 + doc:check
- **出口：** 仅明线

### 必读
- `@docs/architecture/decisions/ADR-021-online-default-thin-offline.md`
- `@docs/product/Yiveno-产品文档-v4.0.md` §0.1.4

### 验收
- `bun run doc:check` 绿
- 产品文档 / ADR-007 / recall-service·backend·hybrid·omnibox 注释无「Omnibox=离线产品」误导句
- 不引入行为变更（本波仅叙事与注释/日志文案）

### 禁止
- 借本 Brief 大重构无关模块
- 为离线加深壳或第二套检索产品
- 灰名单 alias
```
