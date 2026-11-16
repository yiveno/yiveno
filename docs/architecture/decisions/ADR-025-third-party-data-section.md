---
created: 2026-11-16T21:57:50+08:00
updated: 2026-11-16T21:57:50+08:00
author: agent:cursor
scope: docs/architecture/decisions
status: 已接受
upstream: docs/product/Yiveno-产品文档-v4.0.md（§5.10.6 · §5.5 Settings IA）
downstream: extension Settings third_party 分区；第三方导入状态 storage；GET/DELETE 消息
---

# ADR-025: 第三方数据独立分区与按来源管理

- **状态：** 已接受
- **日期：** 2026-11-16
- **决策者：** 维护者（Task Brief：第三方数据分区）
- **前置：** §5.10.6 Raindrop / Pocket 文件导入已上线；Settings「数据与隐私」曾内嵌导入组

## 背景

Raindrop / Pocket 导入原先塞在「数据与隐私」的 Bring in 组，没有按来源的条数/上次导入可见性，也无法只清某一来源的本机导入副本。用户需要统一管理入口，且隐私分区应聚焦披露、备份与清除，而非第三方迁入。

## 决定

1. **单独立栏：** Settings 新增 `third_party`（文案「第三方数据」/ Third-party data），插在 `capture` 之后；导入 UI 从 `privacy` 迁出。
2. **按来源管理：** 每来源一张卡（仅 Raindrop + Pocket）：导入 + 状态行（条数 / 上次导入；失败可见）+ 一键删除全部导入。
3. **硬删语义：** 按 `corpusSource` 硬删本机 bookmark 副本（`hardDeleteMany` 同路径）；清除该来源导入状态；失效书签对齐缓存；不动原服务与 Chrome 书签；同文件可再导入带回。
4. **状态按来源记：** `yiveno.thirdPartyCorpusImport` 由单条 State 改为 `{ raindrop?, pocket? }` map；读路径迁移旧单条。消息：`GET_THIRD_PARTY_CORPUS_SUMMARY`、`DELETE_THIRD_PARTY_CORPUS_BY_SOURCE`；删除无人调用的 `GET_THIRD_PARTY_CORPUS_IMPORT_STATUS`。

## 不做

- 不新增导入来源；不改导入字段（正文/tag/collection）；不在 UI 新提 50 条上限文案变更（§5.10.6 Normative 上限仍在）。
- 不改摘录 Tab、Omnibox、云同步、Dreaming、Recall 主路径。
