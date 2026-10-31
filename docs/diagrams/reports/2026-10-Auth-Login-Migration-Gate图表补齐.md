---
created: 2026-10-31T02:06:01+08:00
updated: 2026-10-31T02:06:01+08:00
author: agent:cursor
scope: Mermaid 第十八阶段 · 补登记图 auth.login-migration-gate（AUTH_GUIDE + registry + 运行时导航一行；不改业务代码）
status: done
upstream:
  - docs/diagrams/reports/2026-10-全局图表覆盖状态重新盘点.md
  - docs/architecture/decisions/ADR-018-account-profile-data-isolation.md
  - docs/AUTH_GUIDE.md
  - extension/src/application/identity/login-migration.ts
  - extension/src/pages/shared/use-login-migration-dialog.ts
  - extension/src/pages/shared/LoginMigrationDialog.vue
  - extension/src/background/handlers/account-sync-handler.ts
downstream:
  - bun run docs:check-diagrams
  - bun run docs:diagram-impact
  - docs/diagrams/registry.json（新增 auth.login-migration-gate）
---

# Auth Login Migration Gate 图表补齐（2026-10-31 · 第十八阶段）

> **本轮约束：** 补历史 **P1-3** / 第十七阶段最高补图候选；**不**改业务代码 / 测试；**不**把 mint 图画进本图；**不**画孤儿桶旁路 / 云同步。  
> **焦点：** 无主摘录如何识别 → 强制三选一 → 各分支对归属的真实后果（拒绝/取消/失败分列）。

---

## 0. 一句话结论

在 `docs/AUTH_GUIDE.md` 新增 `flowchart` **`auth.login-migration-gate`（implemented）**：UI 在已登录时轮询 `GET_LOGIN_MIGRATION_STATUS`；仅 `localProfileId` 未软删摘录触发强制弹窗；Import remap 摘录+书签（书签不上云）、Export 只下载、Delete 清摘录留书签；**无主窗取消路径**；Export→Keep copies 仍 pending。与 `auth.extension-session-mint-handoff` 分图。

---

## 1. 源码证据摘要

### 1.1 触发

| 事实                                                                   | 证据                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 无主 = 未登录写在 `localProfileId` 的 `text_excerpt`                   | `login-migration.ts` 文件头 + `collectUnownedLocalExcerpts`                   |
| 盘点只读本地档；外账号桶不计                                           | 单测「外账号桶摘录不计入」；不调 `listOwnerBucketSummaries`                   |
| `pending = excerptCount > 0`（未软删）                                 | `summarizeLoginMigration`                                                     |
| 无 binding → 不 pending                                                | `summarizeLoginMigrationForCurrentBinding`                                    |
| UI：Side Panel / Settings 在 `signedIn` 时 `refreshLoginMigrationGate` | `SidePanel.vue` `loadGreetingIdentity`；`use-settings-page` `loadSyncContext` |
| handoff **不**内联弹窗                                                 | mint 图仅 Note「禁止静默 absorb」；`loginMigrationPendingUi` 日志旁路         |

### 1.2 用户决策（分列）

| 动作                                  | 后果                                                              |
| ------------------------------------- | ----------------------------------------------------------------- |
| Import                                | `remapOwnerIdByType` 摘录→`accountId`；同桶书签一并 remap；关主窗 |
| Export                                | 导出含软删摘录 JSON；**不改归属**；开二次确认                     |
| Export → Keep copies                  | `dismissDeleteAfterExport`：关二次确认，**主窗仍开**              |
| Export → Confirm Delete / 直接 Delete | `replaceOwnerItems` 去掉本地档全部摘录；保留书签；关窗            |
| resolve 失败                          | error 文案；**主窗不关**                                          |
| GET_STATUS 失败                       | catch 静默；不阻断主 UI                                           |
| 主窗「取消/Esc/点遮罩」               | **未实现**：`close-on-escape=false`；无 X；无 `@close`            |

### 1.3 数据边界

- **迁：** 无主摘录归属；Import 时本地档书签归属账号桶（本机连续）。
- **不迁/不动：** 云副本；外账号桶；Delete 时书签壳。
- **重复：** remap **不做**内容去重（仅改 `ownerId`）。
- **上云：** Import ≠ 开同步；仍须 Pro + 开关（ADR-017）。

---

## 2. 变更清单

| 路径                                                                 | 动作                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------- |
| `docs/AUTH_GUIDE.md`                                                 | 新增 §登录迁移门闸 + Mermaid；文首索引；mint「不含」改指向本图 |
| `docs/diagrams/registry.json`                                        | 新增 `auth.login-migration-gate`；mint notes 互指              |
| `docs/architecture/Yiveno-运行时架构流程-v1.md`                      | 跨图导航表加一行                                               |
| `docs/diagrams/reports/2026-10-Auth-Login-Migration-Gate图表补齐.md` | 本报告                                                         |

**未改：** 业务代码、ADR-018 正文、mint Mermaid 边、孤儿清理 UI。

---

## 3. 验证

```text
bun run docs:check-diagrams
→ ✅ diagrams 校验通过（16 张）

bun run docs:diagram-impact --paths \
  extension/src/application/identity/login-migration.ts \
  extension/src/pages/shared/use-login-migration-dialog.ts \
  extension/src/pages/shared/LoginMigrationDialog.vue \
  package.json
→ auth.login-migration-gate 命中上列实现路径
→ package.json UNMATCHED（预期）
```

---

## 4. 与盘点对齐

| 项                         | 本轮       |
| -------------------------- | ---------- |
| 第十七阶段 P1-3 / 补图序 2 | **已落地** |
| 不与 mint 合并             | **遵守**   |
| 不画 Billing / GS          | **遵守**   |

---

## 5. 未解决问题

| 项                         | 说明                         |
| -------------------------- | ---------------------------- |
| Settings 孤儿桶清理        | 故意不进本图；需要时另 Brief |
| website-session / 退出解耦 | 仍散文（第十七阶段持平）     |
| MCP 真机弹窗               | 未跑（文档-only）            |

### 停止线

第十八阶段完成。**停止**；等待下一阶段指示。
