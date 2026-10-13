# ADR-008: Detail export（详情导出）定位与命名

- **状态：** 已接受
- **日期：** 2026-08-29
- **决策者：** 产品 + 维护者

## 背景

Library / Side Panel 多选导出原称 **Evidence pack**，叙事偏重「交给外部 AI / Agent」，与产品实际能力不符：

- 用户核心需求是：在 **Recall 或 Library** 认下条目后，除在 Chrome 打开外，还能 **带走带来源的完整详情**（复制或下载），**不预设**下游用途。
- 「Evidence pack」易与 ECS **证据**（Explain 层可验证单元）混称。

原 Normative 限制 **2–5 条**、仅下载，亦与「任意选中 + 复制/下载自选」不符。

## 决定

1. **产品名词（用户可见）：** **Detail export**（详情导出）。副心智：_Copy details with sources_（带出处复制详情）。
2. **定位（Normative）：** 用户在自己库或 Recall 邻域中 **主动多选** MemoryItem → **复制到剪贴板** 和/或 **下载** Markdown / JSON；每条含 id、URL、时间、摘录/标题、可选附注。**禁止**整库 dump。
3. **条数：** UI 多选 **无上限**；导出/复制须 **至少 1 条** 已选条目。
4. **出口：** **Copy Markdown**、**Copy JSON**、**Download Markdown**、**Download JSON** 四者并列，用户自选；不得合并为单一隐式格式。
5. **实现命名（2026-08-29 迁移完成）：** 消息 `EXPORT_DETAIL_EXPORT`；错误码 `DETAIL_EXPORT_*`；核心模块 `detail-export.ts`、`DetailExportBar.vue`；JSON `version: 1` 形状不变。
6. **MCP（§5.10.5）：** 工具名 `yiveno_recall_evidence` 不变；单次 clue 响应仍 **1–5 条**（Agent 场景），与 UI Detail export **分轨**；响应条目 schema 与 Detail export 条目同构。

## 后果

**必须：**

- 术语表 + 产品文档 §5.10.4 + Reuse 环叙事与本文一致。
- 移除 UI 2–5 条门禁；`parseExportDetailExportPayload` 为 `ids.min(1)` 无 `max`。
- `DetailExportBar` 四出口（Copy/Download × Markdown/JSON）。

**禁止：**

- 产品文案以「给 ChatGPT / Agent」作主卖点。
- 将 Detail export 叙述为整库备份或 Portable。

## 参考

- 产品文档 §5.10.4 · §5.10.5
- `extension/src/core/recall/detail-export.ts`
- ADR-004（LLM 不碰数据平面）
