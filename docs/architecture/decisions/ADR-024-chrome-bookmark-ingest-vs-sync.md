---
created: 2026-11-16T20:02:02+08:00
updated: 2026-11-16T20:02:02+08:00
author: agent:cursor
scope: docs/architecture/decisions
status: 已接受
upstream: docs/product/Yiveno-产品文档-v4.0.md（§5.8 Getting Started · Settings 书签）
downstream: extension/src/core/settings/user-settings.ts, chrome-bookmark-sync-service, settings-handler, GettingStartedBookmarksPanel, Settings 保存分区
---

# ADR-024: 书签一次性导入与持续同步拆分

- **状态：** 已接受
- **日期：** 2026-11-16
- **决策者：** 维护者（知情同意：Import ≠ Sync）
- **前置：** 产品文档书签灌库默认关；Getting Started 一次性 Import 文案；ADR-023 墓碑

## 背景

原先单一 `chromeBookmarkIngestEnabled` 同时控制一次性 bulk 与 `bookmarks.*` 持续监听。Getting Started 授权文案是一次性说法，但点下后实际开启持续同步——知情同意缺口。

## 决定

1. **两键：** `chromeBookmarkIngestEnabled` = 一次性导入授权记录（默认关）；`chromeBookmarkSyncEnabled` = 持续同步（默认关）。
2. **GS：** 同意只置 ingest → 立即 bulk；导入完成后可建议开 sync（可 dismissal）；不暗开 sync。
3. **Settings：** 主开关 = sync（开时披露并导入现有；关只卸监听）；ingest 已开时提供「重新导入」；锚点 `#chrome-bookmark-ingest` 保留。
4. **门禁：** 监听 / repair alarm / reconcile·repair = sync；会话级 ensure 补洞仍查 ingest（finalize 内对账仍受 sync）。
5. **迁移：** 存量缺 `chromeBookmarkSyncEnabled` 时 `sync = ingest`。

## 不做

- 不改摘录 Tab / Omnibox / 云同步叙事。
- 不把 Side Panel 空库燃料改成第三套授权流（仍深链 Settings sync 开关）。
