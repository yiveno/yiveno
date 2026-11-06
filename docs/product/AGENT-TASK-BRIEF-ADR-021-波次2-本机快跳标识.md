# Task Brief · ADR-021 波次 2 · 本机快跳标识

> **状态：** 已完成（2026-11-06）  
> **前置：** 波次 1 叙事标清已完成

---

```text
## Task Brief

### Scope
- **In：**
  - flow log mode：`omnibox_offline` → `omnibox_local`（本机快跳；≠离线产品）
  - `browser-online.ts` 注释对齐 ADR-021 薄适配读法
  - 产品文档 changelog / 波次1 Brief 状态勾掉「未改字面」
- **Out：**
  - 不改 diagram id `runtime.omnibox-offline-recall`（历史登记名；宿主已注 ADR-021）
  - 不改 ADR-007 文件名
  - 不合并 Omnibox 关键词轨与 Side Panel Hybrid（产品分轨，非离线债）
  - 不加深离线壳 / 不改 i18n / 不调召回质量

### 双线程五问
- **出口：** 仅明线（防日志/遥测字面继续误导「offline 产品」）

### 验收
- 仓内生产 TS 无 `omnibox_offline` 字面
- `doc:check` 绿；相关单测绿

### 禁止
- 借机大重构 Hybrid / 理解层
- 灰名单 alias
```
