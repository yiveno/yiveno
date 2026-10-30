---
created: 2026-10-31T00:34:42+08:00
updated: 2026-10-31T00:34:42+08:00
author: agent:cursor
scope: Mermaid 第六阶段 · 补登记图 sync.excerpt-cloud-pro-gate（只改 ADR-017 / registry / 本报告；不改业务代码）
status: done
upstream:
  - docs/diagrams/reports/2026-10-全局图表覆盖与风险盘点.md
  - docs/diagrams/reports/2026-10-Auth-Extension-Session图表补齐.md
  - docs/diagrams/registry.json
  - docs/engineering/Yiveno-Mermaid图表规范.md
  - docs/architecture/decisions/ADR-017-cloud-sync-excerpt-only.md
  - docs/product/Yiveno-产品文档-v4.0.md
  - extension/src/background/handlers/account-sync-handler.ts
  - worker/src/routes/memory-sync.ts
downstream:
  - bun run docs:check-diagrams
  - docs/diagrams/registry.json（新增 sync.excerpt-cloud-pro-gate）
---

# Pro 云同步图表补齐（2026-10-31）

> **本轮约束：** 补盘点 **P0-2** `sync.excerpt-cloud-pro-gate`；**不**改业务代码 / API / 同步策略；**不**顺手开 Billing / Outcome / Omnibox / Bookmark Ingest。  
> **口径：** 代码事实与 Normative 分列；不确定不编边。

---

## 0. 一句话结论

登记 **flowchart**：钉死 **同步 = Pro + 登录 + 开关**、**面仅 `text_excerpt`（书签不上云为 ADR 契约）**、开同步三向对齐、**15min 增量 = pull→LWW→push（非 replace）**、Worker **403 Pro / 409 缩量保护**、**关开关 ≠ 删云**、Pro 失效关开关（无 snapshot 不因 unknown 误关）。

---

## 1. 实际同步链路

### 1.1 开同步（`SET_SYNC_ENABLED true`）

1. 须 `AccountBinding`；否则 `SYNC_NOT_AUTHENTICATED`。
2. `isProActiveFromSnapshot()`（`isPro` + `tier=pro` + `status=active` + 未过 `currentPeriodEnd`）；否则 `SYNC_PRO_REQUIRED`。
3. 隐私 notice 已 ack；否则 `PRIVACY_NOTICE_REQUIRED`。
4. `patchSyncPrefs({ enabled: true })`（键 `yiveno:sync_prefs`）。
5. 对齐（同步面计数 / 出站仅摘录）：
   - 本机有摘录、云空 → `replace` 本机盖云
   - 本机同步面空、云有 → pull 后仅写摘录到本机（bookmark 保留）
   - 两边都有 → LWW 并集 → `replace` 云（`allowDestructiveShrink` 摘历史 bookmark）→ 写本机全集
   - 对齐失败 → **回滚** `enabled=false`（防半开）
6. `ensureMemoryCloudSyncAlarm(true)`（周期 15 分钟）。

### 1.2 关同步（`SET_SYNC_ENABLED false`）

`enabled=false` + 清闹钟。**不**调删云 API。删云须另走 `DELETE_CLOUD_MEMORY`（登录即可，Worker `delete-all` 注释：隐私路径不强制 Pro）。

### 1.3 增量（闹钟 / 「立即同步」）

`handleIncrementalMemorySync`：须 enabled；`pull(since=lastPulledAt)` → Zod 解析 → `filterCloudSyncable` → LWW 写本机变更 → `selectMemoryItemsToPush` → `push`（上云前 `stripLocalOnlyClueFieldsForCloud` 剥 embedding）→ 更新水位。**不**整侧 replace。

### 1.4 Pro 失效

`refreshSubscriptionSnapshot` 成功写快照后调 `enforceSyncRequiresPro`：若 enabled 且有 snapshot 且非有效 Pro → 关开关 + 清闹钟。**无 snapshot → 不误关**（可能尚未拉到）。服务端后续 pull/push 仍会 `403 pro_required`。

---

## 2. Pro 与开关门禁机制

| 层                | 位置                                               | 行为                                  |
| ----------------- | -------------------------------------------------- | ------------------------------------- |
| 扩展开同步        | `handleSetSyncEnabled`                             | 本机 snapshot 拦开；非 Pro 不得开     |
| 扩展维持          | `enforceSyncRequiresPro`                           | 刷新订阅后关失效账号的开关            |
| Worker 写/拉      | `denyUnlessActivePro` on pull/push/replace/restore | `403 { error: pro_required }`         |
| Worker status     | `GET /status`                                      | **仅登录**（开同步前数云端条数）      |
| Worker delete-all | 隐私删云                                           | **仅登录**（注释明示可不 Pro）        |
| 开关存储          | `SyncPrefs` · `yiveno:sync_prefs`                  | 默认 `enabled=false`；登录 ≠ 自动上传 |

客户端与服务端**均**约束：扩展防误开；Worker 防绕过客户端硬推。

---

## 3. 数据范围与排除项

| 项                | 结论                                                    | 依据                                  |
| ----------------- | ------------------------------------------------------- | ------------------------------------- |
| 上云/拉回工作集   | **仅** `text_excerpt`                                   | ADR-017 · `isCloudSyncableMemoryItem` |
| 书签              | **不上云**；pull 忽略远程 bookmark；本机灌库另路径      | ADR-017 Normative（非「暂时没覆盖」） |
| 书签附注          | 随 bookmark 本机；本版不单独上云                        | ADR-017 §3                            |
| embedding         | 上云前剥离                                              | `stripLocalOnlyClueFieldsForCloud`    |
| Backup 导出       | 可含全部类型                                            | ≠ 云同步面                            |
| 遗留云端 bookmark | 开同步 merge/replace 允许 `allowDestructiveShrink` 摘除 | 不得硬删本机书签                      |

---

## 4. 增量同步与冲突处理

| 主题                  | 代码事实                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------- |
| 触发                  | `chrome.alarms` 15min；Settings 立即同步同 handler；关同步/退出/Pro 失效清闹钟              |
| 合并                  | 同 id LWW（`updatedAt` 较新胜；相等保留云端，见 merge 注释）                                |
| 水位                  | `lastPulledAt` / `lastPushedAt`；push 选 `updatedAt > lastPushedAt` 的摘录                  |
| pull 空但 status 有数 | 全量路径中止（`pull_empty_mismatch`），防缩量盖云                                           |
| Zod 丢条              | 中止；**类型过滤**掉 bookmark 不算解析失败                                                  |
| replace 409           | `empty_local_replace_denied` / `destructive_shrink_denied` — **数据保护性拒绝**，≠ 网络 5xx |
| 恢复                  | `RESTORE_LATEST_SYNC_BACKUP`：账号备份中取条数最多快照恢复云再拉回（仅应用摘录）            |
| 刻意缩量              | 开同步 merge / ADR-017 摘 bookmark / 退出 flush 等显式 `allowDestructiveShrink`             |

---

## 5. 源码与规范差异

| 项                              | Normative          | 代码                               | 图处置                 |
| ------------------------------- | ------------------ | ---------------------------------- | ---------------------- |
| 同步 = Pro+登录+开关            | §账户与同步        | 开同步三检；Worker Pro；失效关开关 | **一致**               |
| 仅摘录                          | ADR-017            | `filterCloudSyncable*` 全路径      | **一致**               |
| 关同步 ≠ 删云                   | §隐私              | 关只清开关+闹钟；删云另 API        | **一致** · Note        |
| 15min 增量非 replace            | §                  | `runIncrementalMemorySync`         | **一致**               |
| 禁止缩量盖云 + 例外             | §                  | Worker 默认拒；显式 allow          | **一致** · 409 节点    |
| status 可不 Pro                 | §「除只读 status」 | 路由无 `requireProForSync`         | **一致** · Server 子图 |
| 无 snapshot 不误关              | 代码注释 + 测试    | `enforceSyncRequiresPro`           | **一致** · Keep 边     |
| **未发现**须用图掩盖的 A/B 冲突 | —                  | —                                  | —                      |

---

## 6. 未解决问题 / 刻意折叠

| 项                                 | 状态                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Dodo webhook → Pro 投影全链        | **未画**（盘点 P2-1）                                                                                                             |
| 退出 `flush_then_keep` 盖云旁路    | **折叠**（同 replace+allowShrink；非日常主链）                                                                                    |
| restore 选「条数最多」备份算法细节 | **折叠**为恢复入口说明                                                                                                            |
| 增量是否可能时钟漂移漏推           | **未在图上断言**；依赖 `updatedAt` 水位，残余风险属实现细节审计外                                                                 |
| Worker 是否另滤 type=bookmark 入站 | 扩展出站已滤；云表若仍有历史 bookmark，pull 后扩展再滤——**服务端未强制 type 门**（以扩展过滤+ADR 出站缩量为准）；图用扩展过滤表达 |
| Billing 收据 / Adaptive Currency   | **范围外**                                                                                                                        |

---

## 7. 验证结果

### 7.1 命令

```bash
bun run docs:check-diagrams
```

**结果（2026-10-31）：** `✅ diagrams 校验通过（12 张）· docs/diagrams/registry.json`

### 7.2 触及路径

| 路径                                                             | 动作                                 |
| ---------------------------------------------------------------- | ------------------------------------ |
| `docs/architecture/decisions/ADR-017-cloud-sync-excerpt-only.md` | 新增「门禁与主链」+ 锚点 + flowchart |
| `docs/diagrams/registry.json`                                    | 新增 `sync.excerpt-cloud-pro-gate`   |
| `docs/diagrams/reports/2026-10-Pro-Cloud-Sync图表补齐.md`        | 本文件                               |

**未改：** 业务源码、产品 Normative 契约条文、其它登记图、diagrams 同步脚本。

### 7.3 Diff 边界

| 类别                                                    | 结论                                  |
| ------------------------------------------------------- | ------------------------------------- |
| 业务 / DB / API / 同步策略                              | **未改**                              |
| Auth / Billing / Outcome / Omnibox / Bookmark ingest 图 | **未改**                              |
| 本轮                                                    | ADR-017 一图 + registry 一条 + 本报告 |

### 7.4 停止线

按 Brief：**本阶段完成后停止**，不自动进入 Outcome 通道图（盘点序 4）及后续项。
