---
created: 2026-11-16T15:48:22+08:00
updated: 2026-11-16T15:48:22+08:00
author: agent:cursor
scope: docs/architecture/decisions
status: 已接受
upstream: 产品文档 §6 书签对账 / 记忆库删除（D-3 · 2026-11-10）
downstream: docs/product/Yiveno-产品文档-v4.0.md（书签删除 + 墓碑）, extension/src/core/memory/chrome-bookmark-delete-tombstone.ts, extension/src/infrastructure/storage/chrome-bookmark-delete-tombstone-storage.ts, memory-item-repository.upsertBookmarkFromChrome, chrome-bookmark-bulk-import.bulkPutChromeBookmarkLeaves, handleGetBookmarkLibraryTree
---

# ADR-023: 书签删除墓碑（用户删除优先于 Chrome 权威同步）

- **状态：** 已接受
- **日期：** 2026-11-16
- **决策者：** 维护者（D-3 · 2026-11-10：书签删除只删 Yiveno 记忆，不动 Chrome 书签，且同步不得把删掉的书签重新导回）
- **前置：** 产品文档书签对账「Chrome 书签树 = 壳权威」；`DELETE_MEMORY_ITEM` 摘录软删路径

## 背景

记忆库对账原则是 **Chrome → IndexedDB 单向**：upsert / reconcile / repair 以 Chrome 叶子为准，软删行在 Chrome 仍在时会**复活**。若用户仅要「别再出现在 Yiveno 记忆里」、却保留 Chrome 书签，单靠 `deletedAt` 会被下一次同步清掉。

## 决定

1. **删除语义（D-3）**：记忆库删除书签 Memory = 软删 Yiveno 行；**禁止**调用 `chrome.bookmarks.remove` / `.create` / `.update` / `.move`。
2. **墓碑**：`chrome.storage.local` 键 `yiveno:chrome_bookmark_tombstones` 存已删书签的 `chromeBookmarkId` 集合（**不升 IDB 版本**；本地-only）。
3. **写**：`handleDeleteMemoryItem` 对书签软删成功后写入墓碑；并失效书签对齐缓存与树缓存。
4. **读（choke 点）**：`MemoryItemRepository.upsertBookmarkFromChrome` 遇墓碑 id → 不复活、不新建；`bulkPutChromeBookmarkLeaves` 一次读集合后内存过滤（唯一绕过 upsert 的 bulk 路径）。
5. **树**：`handleGetBookmarkLibraryTree` 映射时跳过墓碑叶子（隐藏行）；库内无反删除入口（与摘录删除无撤销一致）。
6. **对「Chrome 为权威」的例外**：用户显式删除优先于「Chrome 仍在 → 必须进库」。Chrome 仍是壳与原生书签的权威；Yiveno 记忆可拒绝再导入已墓碑 id。

## 已知限制

- 墓碑 **本地-only**：换设备 / 清本地数据后丢失，该书签会从 Chrome 重新导入（D-3 固有性质）。
- `CLEAR_LOCAL_MEMORY` 等是否清墓碑：以产品文档当期 Normative 为准；本 ADR 不另开清除语义。

## 不做

- 不升 `PRIVACY_NOTICE_VERSION`（无新披露面）。
- 不做删除 toast / 撤销（P2）。
- 不做 Detail 页书签删除入口（本批仅 Library）。
