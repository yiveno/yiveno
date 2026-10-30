---
created: 2026-10-31T00:23:36+08:00
updated: 2026-10-31T00:27:33+08:00
author: agent:cursor
scope: Mermaid 第五阶段 · 补登记图 auth.extension-session-mint-handoff（只改 AUTH_GUIDE / registry / 本报告；不改业务代码）
status: done
upstream:
  - docs/diagrams/reports/2026-10-全局图表覆盖与风险盘点.md
  - docs/diagrams/README.md
  - docs/diagrams/registry.json
  - docs/engineering/Yiveno-Mermaid图表规范.md
  - docs/AUTH_GUIDE.md
  - docs/product/Yiveno-产品文档-v4.0.md
  - docs/architecture/decisions/ADR-018-account-profile-data-isolation.md
  - docs/architecture/decisions/ADR-019-website-extension-ui-bridge.md
  - website/src/services/extension-auth-handoff.ts
  - worker/src/services/auth/mint-extension-session.ts
  - extension/src/background/listeners/external-auth-handoff.ts
  - extension/src/background/handlers/account-sync-handler.ts
downstream:
  - bun run docs:check-diagrams
  - docs/diagrams/registry.json（新增 auth.extension-session-mint-handoff）
---

# Auth Extension Session 图表补齐（2026-10-31）

> **本轮约束：** 补盘点 **P0-1** `auth.extension-session-mint-handoff`；**不**改业务代码 / Token 契约 / 同步脚本；**不**顺手开云同步 / Outcome / Omnibox 下一阶段。  
> **口径：** 代码事实与 Normative 分列；planned 不画成 implemented；不确定不编边。

---

## 0. 一句话结论

登记并画出 **官网身份 → Worker mint 扩展独立 session → external handoff → 扩展本机 AuthSession** 的 `sequenceDiagram`，钉死 **Connect ≠ Sign in**、**禁止官网 refresh 直传**、**handoff 失败 uninstall-revoke 回滚**、**挤掉确认 vs 本机孤儿静默认领**。Turnstile e2e 末端「mint/handoff 等」自此有独立权威时序图可对照。

---

## 1. 实际认证链路（代码事实）

### 1.1 两条用户入口

| 入口        | 扩展 message           | 官网落点                                                                                                | 前提                                   |
| ----------- | ---------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Sign in** | `AUTH_SIGN_IN`         | `/login?connect_extension=1&extension_id=…`                                                             | 扩展未登录；用户须在官网完成 OTP/OAuth |
| **Connect** | `AUTH_CONNECT_WEBSITE` | 优先 Port `request_extension_connect` 零导航；无 ack（约 2s）或无 Port → `/account?connect_extension=1` | 官网已有 session；**禁止**先开登录壳   |

纯 `/login`（无 `connect_extension` pending）**不**调用 mint（`getPendingExtensionId()` 空 → `failed` / 跳过）。

### 1.2 mint + handoff 共用核

`mintAndHandoffSessionToExtension`（官网）：

1. **STATUS_PROBE**：扩展已是同一 `userId` → **零 mint**、清 pending、记 `last_extension_id`。
2. 否则 `POST /api/auth/extension-session`，Bearer = **官网 access**（website `mint-extension-session.ts`）。
3. Worker（`worker/.../mint-extension-session.ts`）：Admin `generateLink(magiclink)` + anon `verifyOtp` → **新** Supabase session（独立 refresh 族）+ KV 扩展租约 + 可选 `uninstallRevokeToken`；须有 email。
4. **409 `needs_displace_confirm`**：先 `LEASE_RECLAIM_PROBE`——本机 `lastLease` 匹配且未登录 → **静默** `confirmDisplace`；否则自定义挤掉弹窗。
5. `confirmDisplace`：Worker **先硬撤前序扩展 Auth session**，成功才铸新会话（`displace_revoke_failed` 则不发新会话）。
6. 成功 → `YIVENO_AUTH_SESSION_HANDOFF`（扩展 access/refresh + 资料字段 + revoke token）；先 probe 唤醒 SW、超时 8s、失败再重试一次。
7. handoff 失败或 mint `userId` 与官网不一致 → `rollbackMintedExtensionSession` → `POST /api/auth/extension-uninstall-revoke`。
8. mint 失败：**禁止**把官网 refresh 塞给扩展。

### 1.3 扩展落库

`applyExternalAuthSessionHandoff`：

- Zod 校验 → `setAuthSession` + `setAccountBinding`
- JWT `session_id` → `last_extension_lease_session_id`
- 登记 uninstall revoke；`markAuthValidatedNow`；清 displaced 软条；挂租约闹钟
- 调度 embedding 维护；**禁止**静默 absorb（迁移门闸留给 UI / ADR-018）

### 1.4 Connect vs Sign in · 取消挤掉

| 路径                                                 | 取消挤掉后                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Connect**（`runExtensionConnectFromWebsite`）      | 清 pending；`website_connect_result=cancelled_displace`；**保留**官网 session            |
| **Sign in**（`LoginForm.finishSignedInOnLoginPage`） | `abortWebsiteLoginAfterDisplaceCancel` → **可** `signOut` 官网会话并回 `/login?connect…` |

### 1.5 Refresh（接通后 · 独立生命周期）

扩展 `revalidateAuthSession`：先 `GET` 租约探测（displaced → invalid，不打 refresh）→ 再用**扩展自有** `refresh_token` POST Supabase `/auth/v1/token?grant_type=refresh_token`（节流；single-flight）。网络 / 5xx / rate limit → `uncertain` 保留登录态；仅明确作废 / displaced → keep_local。

**官网 session refresh 与扩展 refresh 不同族、不同存储**——本图用 Note 标明，不画成同一状态机。

### 1.6 UI 桥角色

Port `yiveno-ui-bridge` 只编排 Connect / 推送 `website_auth_changed` 等 UI 态；**不**传 token。铸会话仍走 mint + `sendMessage` external handoff（ADR-019）。

---

## 2. 关键源码与测试依据

| 主题                      | 路径                                                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mint+handoff 编排         | `website/src/services/extension-auth-handoff.ts`                                                                                                                                                                |
| Worker mint / 租约 / 挤掉 | `worker/src/services/auth/mint-extension-session.ts`（及 `.test.ts`）                                                                                                                                           |
| 官网 HTTP 客户端          | `website/src/services/mint-extension-session.ts`（及 `.test.ts`）                                                                                                                                               |
| Connect 编排              | `website/src/services/run-extension-connect.ts`（及 `.test.ts`）                                                                                                                                                |
| handoff 失败回滚          | `website/src/services/rollback-minted-extension-session.ts`                                                                                                                                                     |
| Sign in / Connect handler | `extension/.../account-sync-handler.ts`（`handleAuthSignIn` / `handleAuthConnectWebsite`）                                                                                                                      |
| external 收端             | `extension/.../external-auth-handoff.ts`（listener + core schema）                                                                                                                                              |
| UI 桥                     | `website/.../ui-bridge.ts` · `UiBridgeHost.vue` · `extension/.../ui-bridge.ts`                                                                                                                                  |
| 扩展 refresh              | `extension/.../auth-session-revalidate.ts` · `extension-oauth.ts`                                                                                                                                               |
| 单测（节选）              | `external-auth-handoff.test.ts`（写入 binding / probe / reclaim）；`run-extension-connect.test.ts`；`mint-extension-session.test.ts`（website+worker）；`auth-session-revalidate.test.ts`；`ui-bridge*.test.ts` |

**未改业务代码。**

---

## 3. 图表表达的关键分支

图 id：`auth.extension-session-mint-handoff` · `kind=sequence` · `status=implemented` · 宿主 `docs/AUTH_GUIDE.md`。

| 分支                          | 图上如何表达                                           |
| ----------------------------- | ------------------------------------------------------ |
| Sign in vs Connect            | 顶层 `alt`                                             |
| Connect 幂等（已登录）        | Connect 支内 `alt`                                     |
| Port ack vs `/account` 回退   | Connect 未登录支内 `alt`                               |
| 同账号 STATUS_PROBE 短路      | mint 核 `alt`                                          |
| 409 → 认领 / 弹窗 / 取消      | 嵌套 `alt` + Note（Connect 保留官网 vs Sign in abort） |
| mint 失败不共享 refresh       | Note                                                   |
| handoff 失败 revoke 回滚      | `else` + Worker uninstall-revoke                       |
| 扩展落库与「禁止静默 absorb」 | handoff ok 边                                          |
| refresh 独立生命周期          | 图末 Note（不并入官网 session）                        |

**故意折叠：** Turnstile/OTP；反铸 `website-session`；登录迁移三选一；云同步；遗留 sign-out handoff；卸载页全时序。

---

## 4. 实现与规范之间的差异

| 项                                | Normative / ADR                        | 代码                                                      | 图处置                                   |
| --------------------------------- | -------------------------------------- | --------------------------------------------------------- | ---------------------------------------- |
| 独立 refresh；禁官网 refresh 直传 | §登录态对齐 · AUTH_GUIDE · ADR-018/019 | mint 另铸；handoff 载荷为扩展 tokens；注释明示禁止共享    | **一致** · 凭证表 + Note                 |
| Connect ≠ Sign in                 | §登录态对齐 · ADR-019                  | 两 message；Connect 禁开 `/login` 壳                      | **一致** · 顶层 alt + 入口表             |
| handoff 失败立刻 revoke 回滚      | §登录态对齐                            | `handoffMintedSession` → `rollbackMintedExtensionSession` | **一致**                                 |
| 取消挤掉：Connect 不踢官网        | §登录态对齐                            | `runExtensionConnectFromWebsite` 仅清 pending             | **一致** · Note                          |
| 取消挤掉：Sign in 可清官网会话    | §登录态对齐（connect 入口可清）        | `abortWebsiteLoginAfterDisplaceCancel`                    | **一致** · Note 分叉                     |
| 官网退出不踢扩展                  | ADR-018 / §                            | 新产品路径不发 `SIGN_OUT_HANDOFF`；扩展仍接受遗留消息     | **图外 Note**（遗留兼容不画成主路径）    |
| UI 桥禁传 token                   | ADR-019                                | Port 仅 UI/编排；token 走 external sendMessage            | **一致**                                 |
| 登录迁移门闸                      | ADR-018                                | handoff 后 UI 弹；代码标 `loginMigrationPendingUi`        | **故意不展开**（盘点 P1-3）              |
| 扩展→官网反铸                     | §登录态对齐                            | `YIVENO_WEBSITE_SESSION_REQUEST` + `website-session`      | **故意不展开**（对称链路，非本图主问题） |

**本轮未发现**「Normative 写 A、代码做 B」须用图掩盖的冲突；Cancel 分叉是**规范已写明的双路径**，不是漂移。

---

## 5. 尚未解决 / 刻意折叠

| 项                                        | 状态                                                           |
| ----------------------------------------- | -------------------------------------------------------------- |
| 登录迁移 Import/Export/Delete 时序        | **未画**（候选 `auth.login-migration-gate`）                   |
| 扩展→官网 `website-session` 全链          | **未画**（可后续对称图或并入本图 `opt`）                       |
| Worker 僵死租约 `alive/unknown` 探测细节  | **折叠**为 409 语义；以 Worker mint 模块为准                   |
| 被挤掉 elsewhere 软条 / suppress 窗       | **未画**（Connect/Sign-in 仅标 beginSuppress；软条属存活 UX）  |
| 遗留 Worker 自建 OAuth `/api/auth/start`  | AUTH_GUIDE 标明非主路径；**未**进图                            |
| Turnstile e2e 节点「mint/handoff 等」文案 | **未改** turnstile Mermaid（范围纪律）；靠 AUTH_GUIDE 新图闭合 |

---

## 6. 验证结果

### 6.1 命令

```bash
bun run docs:check-diagrams
```

**结果（2026-10-31）：** `✅ diagrams 校验通过（11 张）· docs/diagrams/registry.json`

### 6.2 触及路径

| 路径                                                              | 动作                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `docs/AUTH_GUIDE.md`                                              | 新增 §扩展 Session mint/handoff + 锚点 + Mermaid + 入口/凭证表；更新日期                   |
| `docs/diagrams/registry.json`                                     | 新增 `auth.extension-session-mint-handoff`（codePaths / docPaths / notes）                 |
| `docs/diagrams/reports/2026-10-Auth-Extension-Session图表补齐.md` | 本文件                                                                                     |
| `.gitignore`                                                      | 对 `docs/diagrams/reports/` 取反；根规则 `reports/` 曾吞掉 README 标明「可提交」的审阅报告 |

**未改：** 业务源码、产品 Normative 契约条文、其它 10 张登记图、diagrams 同步脚本。

### 6.3 Diff 边界（验收）

| 类别                                    | 结论                                                         |
| --------------------------------------- | ------------------------------------------------------------ |
| 业务 / Token / Worker mint 逻辑         | **未改**                                                     |
| 其它域 Mermaid（Turnstile / runtime.*） | **未改**                                                     |
| 同步脚本 `scripts/sync-diagrams*`       | **未改**                                                     |
| 本轮新增/修改                           | AUTH_GUIDE 一图 + registry 一条 + 本报告 + `.gitignore` 取反 |

### 6.4 停止线

按 Brief：**本阶段完成后停止**，不自动进入云同步 Pro 门禁图（盘点序 3）及后续项。
