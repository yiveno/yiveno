---
created: 2026-11-20 14:57 +0800
updated: 2026-11-22 09:55 +0800
author: agent:cursor
scope: S0 设备 token（D 方案）设计稿；不实施产品代码
status: implemented-s1
upstream:
  - docs/AUTH_GUIDE.md
  - docs/architecture/decisions/ADR-018-account-profile-data-isolation.md
  - docs/architecture/decisions/ADR-019-website-extension-ui-bridge.md
  - docs/product/Yiveno-产品文档-v4.0.md（§登录态对齐）
  - worker/src/services/auth/*
  - extension/src/infrastructure/auth/*
  - website/src/services/extension-auth-handoff.ts
downstream:
  - 后续 W1 / E1 / E2 / 设备注册实现批（本文件为规格源）
---

# 设备 token（D 方案）设计稿

> **本文件 = 设计规格，不改产品代码。**  
> 基线核对：HEAD `425d199b`（提示词预期 `2bc8489b` 已漂移，以实测为准）；`test:must` 127 / `test:run` 1802 / `i18n` 844 / `worker` 211。

## 0. 背景与目标

### 0.1 现状（代码事实）

- 扩展持 **Supabase Auth 会话**（`accessToken` + `refreshToken`），键 `yiveno:auth_session`（`extension/src/core/identity/auth-session.ts`）。
- 官网 → 扩展：Worker `POST /api/auth/extension-session`（`supabaseAuth` + `mintExtensionSession`）铸造**独立** Supabase session，再 `YIVENO_AUTH_SESSION_HANDOFF` 写入扩展（`website/src/services/mint-extension-session.ts`、`extension-auth-handoff.ts`；`worker/src/routes/auth.ts` L80–150）。
- **扩展单活跃**：`AI_USAGE_KV` 键 `ext_auth_session:{userId}`（`extension-session-lease-kv.ts`）；已有租约 → 409 `needs_displace_confirm`；确认后硬撤前序 Auth session（`mint-extension-session.ts` L146–197）；扩展侧 1 分钟闹钟 + `GET /api/auth/extension-session-lease` 探测 displaced（`auth-session-lease-alarm.ts`、`extension-session-lease-probe.ts`、`auth-session-revalidate.ts`）。
- 扩展 → 官网：Bearer=扩展 access → `POST /api/auth/website-session` → `issueSupabaseUserSession`（扩展侧 `website-session-from-extension.ts`；`FromExtensionAuth.vue`）。
- AI / 账户 / Memory sync / billing 等扩展调用面：一律 `supabaseAuth()` 验 Supabase JWT（`worker/src/middleware/supabase-auth.ts`；`routes/ai.ts`、`account.ts`、`memory-sync.ts`、`billing.ts`、`research.ts`）。
- Worker **无 D1 绑定**（`wrangler.toml` 仅见 `AI_USAGE_KV` 等）；租约 / 卸载 revoke / 配额均在 KV。

### 0.2 已定方向（用户批准 2026-11-20）

1. **匿名试用（方案 C）**：扩展自动拿匿名账号；LLM 15 次终身、embeddings 前 30 条终身；转正同 `userId`；Turnstile 只出 captcha token（官网页）。
2. **单活跃拆除**：书签按 Chrome Profile、摘录按 id+LWW，**不足以**支撑「扩展不可多机」；且与 Pro 多机价值冲突。
3. **本批 D 方案**：扩展**不再**持 Supabase 会话，改持 Worker 签发的 **device token**（每设备一条、可撤销）；官网账户页设备列表；删除租约 / 409 / 认领 / 闹钟 / displaced 软条。

### 0.3 非目标

- 本文件不实施代码、不改测试 / i18n / 配置。
- **E 方案**仅写规格（§9），不实施。
- B1（Turnstile 桥）、O1（清理 cron）不变（§8）。

---

## 1. 设备 token 模型

### 1.1 格式（推荐：**opaque 随机串**，非 JWT）

| 项                  | 结论                                                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **格式**            | Opaque：与现有卸载作废票同构——`crypto.randomUUID()` 去连字符拼接 **两次** → **64 hex 字符**（`createExtensionUninstallRevokeToken`，`extension-uninstall-revoke-kv.ts` L28–31）              |
| **熵**              | ~122 bit（2× UUID v4）；足够作 Bearer 密钥                                                                                                                                                   |
| **不选 JWT 的理由** | ① 撤销必须服务端立失效 → 每次请求仍要查存储，JWT「本地验签免查库」优势落空；② 扩展不需要自解析 `userId`/`is_anonymous`（避免 claim 过期与转正不同步，见 §6）；③ 与现有 KV token 运维习惯一致 |

前缀建议（传输与日志）：`ydt_`（Yiveno Device Token）+ 64 hex，便于与 Supabase JWT / uninstall revoke 区分；**存储与比对用完整串**（含前缀）。

### 1.2 签发流程

```text
鉴权完成（见 §2.1）→ Worker 生成 token
  → 写 KV 记录（§1.3）
  → 更新该 user 的设备索引
  → 返回 { deviceToken, userId, email?, displayName?, avatarUrl?, isAnonymous, deviceId }
  → 扩展只持久化 deviceToken + 展示字段（无 refresh）
```

`deviceId`：Worker 生成的 UUID（设备行主键）；扩展可本地缓存，撤销 / 列表以服务端为准。

### 1.3 Worker 侧存储（推荐：**AI_USAGE_KV**，非 D1）

**依据：** 现状租约 / 卸载 revoke / 配额全在 `AI_USAGE_KV`（`extension-session-lease-kv.ts`、`extension-uninstall-revoke-kv.ts`、`usage-quota.ts`）；`wrangler.toml` **无 D1**。为设备列表引入 D1 会新增绑定、迁移与运维面，本波不必要。

| 键                   | 值（JSON）                                                                                                         | TTL                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `devtok:{token}`     | `{ deviceId, userId, createdAt, lastSeenAt, deviceLabel, platform, extensionId?, isAnonymousAtIssue, revokedAt? }` | **无过期**（主动撤销 / 删号删键）；可选 `expirationTtl` 仅作极端滞留兜底（如 400 天），**撤销不依赖 TTL** |
| `user_devs:{userId}` | `{ devices: [{ deviceId, deviceLabel, platform, createdAt, lastSeenAt, tokenKeySuffix }] }`                        | 无过期；`tokenKeySuffix` = token 末 8 字符仅供运维对照，**不是**密钥                                      |

- **查找路径（热路径）：** Bearer → `devtok:{token}` → `userId`（O(1)）。
- **列表路径：** `user_devs:{userId}`；撤销时同步删 `devtok:` 并改索引。
- **安全：** 日志只打 `deviceId` / token 末 4 字符；禁止完整 token 进 log（对齐现有 Auth 习惯）。

不选 D1 的代价：KV 列表非强一致、无 SQL；设备数预期个位数～十来台，JSON 索引可接受。若日后要审计大表再迁 D1。

### 1.4 扩展侧存储

| 项                | 结论                                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **新键**          | `yiveno:device_session`（替换 `yiveno:auth_session`）                                                                                         |
| **Schema（Zod）** | `{ deviceToken: string.min(32), userId: uuid, email?: email, avatarUrl?: url, displayName?: string, deviceId?: uuid, isAnonymous?: boolean }` |
| **删除字段**      | `accessToken`、`refreshToken`、`expiresAt`（全部属于 Supabase 会话）                                                                          |
| **服务层**        | `auth-session-service.ts` 改为读写新键 / 新 schema（或更名为 `device-session-service`，调用方批量改 import）                                  |

`AccountBinding`（`yiveno:account_binding`）**保留**：`accountId` = `userId`（`local-profile.ts`）；与设备 token 并列，供 owner 解析。

### 1.5 验证流程

```text
Authorization: Bearer <deviceToken>
  → deviceAuth 中间件
  → kv.get(devtok:{token})
  → 无记录 / revokedAt 有值 → 401 invalid_token
  → 命中 → c.set('deviceUserId', userId) 等
  → 异步/节流更新 lastSeenAt（见下）
```

| 项               | 结论                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **是否每次查库** | **是**（KV get）；opaque token 无本地验签捷径                                                                                                                              |
| **缓存**         | Worker 实例内 **短 TTL 内存缓存**（推荐 30–60s）：`token → { userId, deviceId, isAnonymous }`；**撤销时无法广播所有 isolate** → 缓存只能缩短最坏窗口，**不能**替代 KV 删键 |
| **缓存失效**     | ① TTL 到期；② 本 isolate 处理撤销请求时 `delete` 本地缓存项；③ 接受跨 isolate ≤TTL 的延迟（产品可接受；盗用止血靠用户点撤销 + 可选「撤销全部设备」）                       |
| **lastSeenAt**   | 成功鉴权后 **节流写**（如每设备 ≥5min 才 put），避免每个 AI 请求打满 KV 写配额                                                                                             |

### 1.6 轮换与被盗止血

| 策略         | 结论                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **过期**     | **默认不过期**（长期登录；与「扩展免刷新」目标一致）。可选：闲置 >180 天软提示重连，**不**自动踢（开放问题不占名额：推荐不做硬过期）      |
| **轮换**     | 不主动轮换；**重新 Connect / 匿名重注册** = 发新 token，旧 token 可保留（多设备）或由用户在账户页撤旧                                     |
| **被盗止血** | ① 账户页撤销该设备（删 `devtok:`）；② 「Sign out all devices」清 `user_devs` 下全部；③ 删号路径清全部设备键（接 `deleteAccountForOwner`） |

### 1.7 撤销语义

- **单设备撤销：** 官网 Bearer → `DELETE /api/auth/devices/:deviceId` → 删 `devtok:{token}` + 更新 `user_devs` → **立即**（对该 isolate 与无缓存命中）401。
- **保证方式：** 权威在 KV 有无记录；**不以** JWT `exp` / 黑名单延迟列表为准。
- **扩展表现：** 下次 AI / sync / 状态探测收到 401 → 走与今日 `revalidate invalid` 同等的 **keep_local** 退登（清 binding / 账号桶策略不变，ADR-018），**不再**出现 displaced「别处登录」文案（该场景改为「此设备已在账户页撤销」或静默未登录）。

---

## 2. Worker 端点清单

### 2.1 设备注册（扩展首次拿 token）

**端点：** `POST /api/auth/device-register`（新建；取代扩展路径上的「铸造 Supabase session」职责）。

| 入参                       | 说明                                      |
| -------------------------- | ----------------------------------------- |
| `extensionId`              | `chrome.runtime.id`（元数据）             |
| `deviceLabel` / `platform` | 可选；缺省由 Worker 从 `User-Agent` 推导  |
| `mode`                     | `'website_connect' \| 'session_exchange'` |

**鉴权（注册时扩展尚无 device token）——按 mode：**

| mode               | 鉴权                                               | 行为                                                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `website_connect`  | **`supabaseAuth()`**（官网 access Bearer）         | 已登录正式/匿名官网用户 → 为该 `userId` 发一条 device token（**不**挤掉其它设备；**不**写 `ext_auth_session`）                                                                                                                        |
| `session_exchange` | **`supabaseAuth()`**（扩展持临时 Supabase access） | ① 升级迁移：验旧版 `yiveno:auth_session` JWT → 发 device token → 扩展删旧会话（§4.2）；② **匿名 signup 后 exchange**：扩展 GoTrue 匿名 signup 后用该会话 exchange；Worker **不**直接建匿名号。JWT `is_anonymous` 透传写入 `user_meta` |

> **Spike（2026-11-20）：** Admin `createUser` 三种变体（空 body / `is_anonymous: true` / 带 `email_confirm`）均 `validation_failed: Cannot create a user without either an email or phone`。Worker 侧 `anonymous_bootstrap` 路径已删除；匿名走扩展 signup + `session_exchange`。  
> **Turnstile：** captcha 由 Supabase 在 signup 时校验；**Worker 不需要 Turnstile secret**。

**出参：** `{ success, data: { deviceToken, deviceId, userId, email, isAnonymous, …profile } }`。

**与旧 `POST /api/auth/extension-session` 关系：** 实现期可：① 改写同路径语义为 device-register；或 ② 新路径 + 弃用旧路径。**推荐 ②**，避免官网旧缓存页与新扩展混用歧义；弃用期旧路径返回 410。

**不再返回：** `accessToken` / `refreshToken` / `uninstallRevokeToken`（卸载改撤 device token，见 §4.4）/ `displaced` / 409。

### 2.2 Token 验证中间件（替换范围）

新建 `deviceAuth()`（`worker/src/middleware/device-auth.ts`）：Bearer → §1.5。

| 路由族                  | 鉴权                                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **改走 `deviceAuth`**   | 扩展调用的：`/api/ai/embed`、`/hosted/*`、`/dreaming/complete`；`/api/memory-sync/*`；扩展向的 `/api/account/subscription`、`/mcp`；`POST /api/auth/website-session`（反向接通）；扩展主动 `POST /api/auth/device-revoke-self` |
| **保留 `supabaseAuth`** | 官网调用的：`POST /api/auth/device-register`（`website_connect` / 列表与撤销的读侧）；`billing` 若官网结账仍用官网 JWT；遗留 OAuth ` /api/auth/start                                                                           | callback`；账户页设备列表 `GET/DELETE /api/auth/devices*` |
| **双接受（过渡）**      | 升级窗口内：`deviceAuthOrSupabaseAuth`——先识别 `ydt_` 前缀走 device，否则走 Supabase；迁移完成后删 Supabase 分支                                                                                                               |
| **公开 / 其它**         | IP 配额类 `/api/ai/clue                                                                                                                                                                                                        | enrichment                                                | gs-clue-samples` 维持现状；`extension-uninstall-revoke` 改为消费 **device 卸载票** 或直接删 device（§4.4） |

**匿名用户：** 同样持 device token；中间件不区分，配额层读 `isAnonymous`（§2.4）。

### 2.3 撤销与设备列表（官网账户页）

| 端点                                 | 鉴权                | 行为                                      |
| ------------------------------------ | ------------------- | ----------------------------------------- |
| `GET /api/auth/devices`              | 官网 `supabaseAuth` | 读 `user_devs:{userId}` → 列表            |
| `DELETE /api/auth/devices/:deviceId` | 官网 `supabaseAuth` | 撤单设备                                  |
| `POST /api/auth/devices/revoke-all`  | 官网 `supabaseAuth` | 撤全部（含当前浏览器对应扩展设备）        |
| `POST /api/auth/device-revoke-self`  | `deviceAuth`        | 扩展 Settings 退出：撤**本** device token |

### 2.4 `is_anonymous` 的获取（推荐：**注册时落库 + 转正时更新**）

| 方案                                                                           | 评价                                                                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **A. 注册/转正写 `user_meta:{userId}` = `{ isAnonymous, email?, updatedAt }`** | **推荐**。配额热路径（`usage-quota.ts` / embed）只读 KV，不打 Admin；与现有 `AI_USAGE_KV` 配额键同存储 |
| B. 每次 Admin `getUserById`                                                    | 正确但延迟与配额敏感路径耦合；仅作落库失败时的回退                                                     |

设备记录可冗余 `isAnonymousAtIssue`（审计）；**权威以 `user_meta.isAnonymous` 为准**（转正后旧设备 token **继续有效**，不必重发，见 §6）。

---

## 3. 官网设备列表页

### 3.1 账户页 UI（`AccountPage.vue`）

在现有账户页（登录态、订阅、Connect 相关）增 **Devices** 区块：

| 展示字段                | 来源                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| 设备名（`deviceLabel`） | 注册时上报 / UA 推导；可后续允许「Rename」                              |
| 平台                    | `platform`（如 `macOS · Chrome`）                                       |
| 最后活跃                | `lastSeenAt`                                                            |
| 注册时间                | `createdAt`                                                             |
| 当前设备标记            | 可选：扩展经 UI 桥上报 `deviceId`，官网高亮「This browser’s extension」 |

**撤销交互：** 行内 Revoke → 确认 → `DELETE /api/auth/devices/:id` → 列表刷新。文案美式英语（经官网 i18n）。

**撤销后扩展：** 无推送通道强制踢人；靠下次 `deviceAuth` 401 → 扩展 `GET_AUTH_STATE` / AI 调用失败路径 keep_local。可选：UI 桥仅同步「官网已登录」态，**不**传 token（ADR-019 不变）。

### 3.2 设备名来源（推荐：**扩展上报 + UA 兜底，允许用户改名**）

1. 扩展注册时传 `deviceLabel`：如 `Chrome · macOS`（`navigator.userAgentData` / UA 解析，**禁止**把完整 UA 当主展示）。
2. Worker 若缺省：用 `User-Agent` 粗解析。
3. 账户页允许 Rename（写回 `user_devs` + `devtok` 记录）。  
   **不**默认要求用户起名（降低接通摩擦）。

---

## 4. 扩展会话存储替换

### 4.1 `yiveno:auth_session` → `yiveno:device_session`

| 旧字段                                           | 处置                      |
| ------------------------------------------------ | ------------------------- |
| `accessToken` / `refreshToken` / `expiresAt`     | **删除**                  |
| `userId` / `email` / `avatarUrl` / `displayName` | **保留**（迁入新 schema） |
| 新增 `deviceToken` / `deviceId` / `isAnonymous`  | 写入                      |

调用 `getAuthSession()` 取 `accessToken` 的路径（AI client、memory sync、dreaming、cold-start、`website-session-from-extension.ts` 等）改为取 `deviceToken` 作 Bearer。

### 4.2 已登录用户升级迁移（无感）

```text
SW 启动 / GET_AUTH_STATE：
  若存在 yiveno:auth_session 且无 yiveno:device_session：
    POST /api/auth/device-register  mode=session_exchange
      Bearer = 旧 accessToken
    成功 → 写 yiveno:device_session；删 yiveno:auth_session；
           清 AUTH_LAST_* 校验时间戳；撤租约闹钟
    失败 transient → 保留旧会话，下次再试（不踢）
    失败 invalid → 按现 keep_local 退登
```

**回退：** exchange 成功写新键**之后**再删旧键；写新失败不删旧。禁止先删旧再交换。

### 4.3 删除清单（租约 / 闹钟 / 认领 / displaced）

| 文件 / 符号                                                                                                     | 动作                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `worker/.../extension-session-lease-kv.ts` + 测试                                                               | **删除**                                                                                                                        |
| `worker/.../probe-extension-session-lease.ts` + 测试                                                            | **删除**                                                                                                                        |
| `worker/.../release-extension-session.ts` + 测试                                                                | **删除**或改写为 device-revoke-self                                                                                             |
| `worker/.../mint-extension-session.ts` 内租约/409/硬撤逻辑                                                      | **删除**；由 `device-register` 取代                                                                                             |
| `worker/src/routes/auth.ts`：`extension-session-lease`、`extension-session` 旧语义、`extension-session-release` | **删除/替换**                                                                                                                   |
| `extension/.../auth-session-lease-alarm.ts` + `background/listeners/auth-session-lease-alarm.ts`                | **删除**                                                                                                                        |
| `extension/.../extension-session-lease-probe.ts`                                                                | **删除**                                                                                                                        |
| `extension/.../auth-session-revalidate.ts`                                                                      | **重写**：去掉 lease 探测与 refresh；改为可选「轻量 `GET /api/auth/device-ping`」或仅在 401 时退登；删 `AUTH_LAST_REFRESHED_AT` |
| `extension/.../extension-oauth.ts` 中 refresh / mapSupabaseSession                                              | **删除或收窄**（升级 exchange 可暂留 verify）                                                                                   |
| `extension/.../last-extension-lease-session-storage.ts` + 测试                                                  | **删除**                                                                                                                        |
| `extension/.../extension-displaced-notice-storage.ts` + Side Panel displaced UI                                 | **删除**                                                                                                                        |
| `extension/.../suppress-displaced-notice-storage.ts`                                                            | **删除**                                                                                                                        |
| `external-auth-handoff.ts`：`YIVENO_EXTENSION_LEASE_RECLAIM_PROBE`                                              | **删除**                                                                                                                        |
| `website/.../confirm-displace-extension-session.ts` + handoff 内 409/reclaim 分支                               | **删除**                                                                                                                        |
| `account-sync-handler.ts`：displaced 软条、lease 闹钟、`confirmDisplace` 抑制窗                                 | **删除相关分支**                                                                                                                |
| 产品文档 §登录态对齐 / `AUTH_GUIDE.md` / `ENVIRONMENT.md` 单活跃段落                                            | **同批改写**（实现批，非本文件）                                                                                                |

### 4.4 Handoff → 设备注册

**官网 → 扩展（Connect）：**

```text
官网已登录
  →（可选 STATUS_PROBE 同账号短路，保留）
  → POST /api/auth/device-register  mode=website_connect  （Bearer=官网 access）
  → sendMessage YIVENO_AUTH_DEVICE_HANDOFF
       payload: { deviceToken, deviceId, userId, email?, avatarUrl?, displayName?, isAnonymous, uninstallRevokeToken? }
  → 扩展 setDeviceSession + setAccountBinding
```

- **删除：** 409 / `confirmDisplace` / `LEASE_RECLAIM_PROBE` / mint 失败用 uninstall 回滚「活租约」的防孤儿逻辑（改为：handoff 失败则 `device-revoke` 刚发的 deviceId，防幽灵设备行）。
- **卸载票：** 仍可发一次性 token，但消费时 **撤 device token**（不再 `revokeAuthSessionById` 扩展 Supabase session）。键可复用 `ext_uninstall_revoke:` 或改名 `dev_uninstall_revoke:`。

**UI 桥（ADR-019）：** 事件闭集与「禁止 Port 传 token」**不变**；`request_extension_connect` 仍只带 `extensionId`，官网侧改为调 device-register。

---

## 5. 匿名期设备 token

### 5.1 流程（Fallback：扩展 signup + exchange）

```text
扩展首次需要云 AI / 身份：
  →（B1）官网页桥拿 captchaToken；扩展裸 fetch POST /auth/v1/signup（captcha 由 Supabase 校验）
  → 立即持久化待交换会话于 yiveno:pending_anon_session（AN1；仅 exchange / 自身 refresh；禁止 AI / 禁止写 yiveno:auth_session）
  → POST /api/auth/device-register  mode=session_exchange  Authorization: Bearer <anon access>
  → Worker：验 JWT → 读 is_anonymous → 写 user_meta.isAnonymous=true → 发 device token
  → 扩展写入 yiveno:device_session；清 pending；AccountBinding.accountId = 匿名 userId
  → 本地库重归属：localProfileId → 匿名 userId（E1 原设计，保留意图）
  → exchange 非 401 失败：保留 pending + 15min 退避；access 过期先 refresh，refresh 失败才重新 signup
  → exchange 401（AN2）：保留 pending；写独立熔断键 yiveno:anon_exchange_401_backoff（60min）；窗口内 ensure 不 signup / 不 exchange（Settings ignoreBackoff 可绕过）；成功后清 pending + 熔断；device 会话建立时（handoff 成功 / ensure 已有会话）清熔断（AN2.1）
  → AN3：匿名 token claims 的 email:"" 视同无邮箱；claims 校验拒绝记 [VerifySupabase] 诊断（补 getClaims 成功但 Zod/role 拒的观测）
  → AN5（2026-11-21）：Connect handoff 匿名豁免——扩展当前为匿名会话时，官网真实账号 handoff 直接覆盖（匿名是占位非真实账号）；真实账号间仍硬拒 `account_mismatch`。官网 probe 亦豁免（响应带 `isAnonymous` 字段）。
  → AN6（2026-11-22）：设备注册填 `deviceLabel`（`"{浏览器} on {OS}"`，例 `Chrome on macOS`）与 `platform`（OS，例 `macOS`）；扩展 `session_exchange` 与官网 `website_connect` 两路均传；Worker 早已支持（`issueDeviceToken` 默认值 `Unknown device` / `unknown` 仅作兜底）。
```

### 5.2 与方案 C 原设计的差异（必须明示）

| 点            | 方案 C 原稿（E 世界）                                                     | **D 世界**                                                                                                                              |
| ------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 匿名期凭证    | 扩展**直持** Supabase 匿名会话（裸 `signup` + 存 `yiveno:auth_session`）  | 扩展**只持** device token 作业务凭证；signup↔exchange 间待交换会话落 `yiveno:pending_anon_session`（AN1；非 legacy auth 键；不可调 AI） |
| 转正后        | `PUT /auth/v1/user` + **强制 refresh** + **mint 置换**扩展会话 + 撤旧会话 | 见 §6：Worker 转正；**device token 继续有效**；无会话置换                                                                               |
| revalidate    | 跳过租约但仍 refresh                                                      | **无 refresh**；存活 = device token 仍在 KV                                                                                             |
| 单活跃 / 租约 | 匿名也要处理租约特例                                                      | **无租约**                                                                                                                              |

---

## 6. 转正端点（D 世界）

**端点：** `POST /api/auth/promote`（名称可调）。

| 项               | 结论                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **鉴权**         | `deviceAuth`                                                                                                                                |
| **Body**         | `{ email: string, captchaToken?: string }`（若邮件链路仍要 bot 防护）                                                                       |
| **行为**         | Admin `updateUserById`：绑定 email、`email_confirm: true`（Confirm email OFF → 当场生效，**不**发 OTP）；更新 `user_meta.isAnonymous=false` |
| **device token** | **继续有效**；不必重发、不必 mint、不必撤旧                                                                                                 |
| **邮箱冲突**     | Admin 报邮箱已占用 → `409 email_conflict`；扩展 UI「登录合并或换邮箱」（与方案 C 一致，合并策略另 Brief）                                   |

**「转正后强制刷新问题」消失的原因：**  
旧世界依赖 JWT / 会话里的匿名标记或 refresh 后 claims；D 世界 **device token 不含 `is_anonymous` claim**，配额读 **`user_meta`（§2.4）**，转正写库后**下一次**配额检查即见正式用户——无需 refresh、无需换 token。

---

## 7. 反向接通在 D 下的形态

```text
扩展（持 deviceToken）打开账户
  → 同账号短路：UI 桥 website_auth_ui 已同 userId → /account（website-page.ts 逻辑保留）
  → 否则 /auth/from-extension
       →（L1：确认页，用户点 Continue）
       → YIVENO_WEBSITE_SESSION_REQUEST
       → 扩展 POST /api/auth/website-session  Authorization: Bearer <deviceToken>
       → Worker：deviceAuth → userId → issueSupabaseUserSession（复用 issue-supabase-user-session.ts）
       → 回传 access/refresh → 官网 setSession
```

| 项                 | 结论                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **铸造实现**       | **复用** `issueSupabaseUserSession` / `mintWebsiteSessionFromExtension`；仅把入口鉴权从 Supabase JWT 换成 `deviceAuth`                                                                                                                                                                                                              |
| **email_required** | 匿名用户无 email 时：`issueSupabaseUserSession` 今日会 `email_required`（`issue-supabase-user-session.ts` L66–68）。D+匿名：反向接通须 **Admin 生成 link 的替代路径**（如 `generateLink` 对匿名或魔法 token），或产品规定「匿名不可 Open account，先转正」。**推荐：** 匿名 Open account → 引导转正；正式用户才铸官网会话（见 §10） |
| **确认式 L1**      | `FromExtensionAuth.vue` 改为确认后再 `WEBSITE_SESSION_REQUEST`；与 D 正交，可并行                                                                                                                                                                                                                                                   |

---

## 8. D 世界的 W1 / E1 / E2 改写清单

对照 E 世界写法；下列为 **D 下必须改写的内容点**（文件级）。B1 / O1 **不变**。

### 8.1 W1（Worker 匿名档）

| E 世界                                                   | D 世界改写                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 中间件从 JWT 读 `is_anonymous`                           | **`deviceAuth` + `user_meta.isAnonymous`**（或设备记录冗余字段）；`supabase-auth.ts` **不**承担扩展 AI 路径 |
| `usage-quota.ts` 匿名终身档 `ai_usage_lifetime:{userId}` | **保留配额键设计**；`tier` 增加 `'anonymous'`；输入改为 `(env, userId, { isAnonymous, isPro })`             |
| `ai-embed.ts` `embed_anon:{userId}` 30 次                | **保留**；鉴权改 device                                                                                     |
| `ai-dreaming.ts` 挡匿名 403                              | **保留**；读 `user_meta`                                                                                    |
| `ai-hosted.ts` / `config/ai-hosted.ts`                   | 配额解析加匿名终身常量；与月配额分支互斥                                                                    |

### 8.2 E1（扩展匿名身份）

| E 世界                                                              | D 世界改写                                                                                                                 |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 裸 fetch `POST /auth/v1/signup` + captcha in `gotrue_meta_security` | **保留** signup → 写 `yiveno:pending_anon_session` → `session_exchange` → 成功清 pending 写 `yiveno:device_session`（AN1） |
| 会话存 `yiveno:auth_session`                                        | **`yiveno:device_session`**（业务）；待交换另键 `yiveno:pending_anon_session`（非 legacy）                                 |
| `AccountBinding` 写匿名 id                                          | **保留**                                                                                                                   |
| 升级重归属 localProfileId → 匿名 id                                 | **保留**                                                                                                                   |
| revalidate 跳过租约探测                                             | **整段租约/refresh revalidate 删除**；401 → keep_local                                                                     |
| `invalid` 路径孤儿化（不清桶）                                      | 匿名失效策略另定；**推荐**与正式 keep_local 对齐或「匿名无效则清 device 保留本地档」——实现 Brief 钉死                      |

### 8.3 E2（转正）

| E 世界                                                                                  | D 世界改写                                                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 扩展 `PUT /auth/v1/user` + 强制 refresh + `POST extension-session` mint 置换 + 撤旧会话 | **`POST /api/auth/promote`（device Bearer）**；无 refresh / 无 mint 置换 |
| 第 16 次 LLM 内联转正提示                                                               | **保留产品行为**；failure kind 仍可新增；Bearer 已是 device token        |
| Settings 匿名态 `tier: 'anonymous'`                                                     | **保留**；数据来自 `device_session.isAnonymous` 或配额 API               |

### 8.4 B1 / O1

- **B1 Turnstile 桥（方案 B'）：** 仍只出 captcha token；打在扩展 GoTrue signup（非 `device-register` body）。Worker **不**持 Turnstile secret。**薄改口径，非 B1 扩面。**
- **Turnstile 页生命周期（AN4）：** MV3 SW 可能在 30s 等待内被终止，内存里的 `turnstileTabId` / waiter 会丢，残留「Bot check」tab。根治三层、缺一不可：① 开新 tab **前** `closeStaleTurnstileTabs()` 清扫；② 官网 `/auth/turnstile` 发完 token 后页面自 `window.close()`（错误路径 30s 延时自关）；③ **每次 SW 启动**顶层再清扫一次（不用 `onStartup`，覆盖 SW 重启）。清扫只关官网 hostname + `pathname === '/auth/turnstile'` 的非 active tab，并跳过当前等待中的 `turnstileTabId`；**不**持久化 tab id；tab 数恒 ≤1。
- **O1 清理 cron：** **已接线（ADR-028）**——周日 UTC 03:00；清超期 `is_anonymous` Auth 行时**先**撤该用户全部 `devtok` / `user_devs` / `user_meta` / 匿名配额 key，再 Admin `deleteUser`；默认 dry-run。

---

## 9. E 方案 fallback 规格（不实施）

**定义：** 保留扩展 Supabase 会话；**仅删除**单活跃租约体系；多设备可同时持有效 refresh。

### 9.1 删除清单（与 D 的租约删除重叠，但不引入 device token）

| 区域   | 文件（与 §4.3 同核心集）                                                                                                                                                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worker | `extension-session-lease-kv.ts`、`probe-extension-session-lease.ts`；`mint-extension-session.ts` 去掉 409/硬撤/租约写（退化为「纯 `issueSupabaseUserSession` + 可选 uninstall token」）；`routes/auth.ts` 去掉 lease 路由与 409 分支；`release-extension-session` 可保留为「撤本 session」但不清「唯一租约」 |
| 扩展   | lease alarm / probe；revalidate 中 lease 分支；displaced 软条与 suppress；`LEASE_RECLAIM_PROBE`；`last_extension_lease_session_id`                                                                                                                                                                           |
| 官网   | `confirm-displace-*`；handoff 409/reclaim                                                                                                                                                                                                                                                                    |
| 文档   | §登录态对齐「扩展单活跃」整段改写为「扩展可多会话」                                                                                                                                                                                                                                                          |

**mint 简化：** `mintExtensionSession` ≈ 直接调 `issueSupabaseUserSession` + 写 uninstall revoke（无 KV 单活跃）。

### 9.2 工作量估计（行数级）

| 块                                                | 约略                                                            |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Worker 租约/probe/release/mint 瘦身 + 路由 + 测试 | ~800–1200 行删改                                                |
| 扩展 alarm/probe/revalidate/handler/UI/storage    | ~600–900                                                        |
| 官网 handoff/displace                             | ~200–400                                                        |
| 文档 / AUTH_GUIDE / 产品 §登录态对齐              | ~150–300                                                        |
| **合计**                                          | **约 1.8k–2.8k 行触达**（含测试）；纯生产逻辑删改约 **1k–1.5k** |

E **不**解决「扩展持 Supabase 会话 + 匿名直 signup + 转正强制 refresh」复杂度；仅去掉互斥。

---

## 10. 开放问题（≤5；附推荐）→ **S1 采取结果（2026-11-20）**

1. **匿名用户能否反向接通官网？**  
   **推荐：** 不能直接铸官网会话；Open account 引导转正。  
   **S1 采取：** 是——`website-session` 仍 `email_required`；扩展回传明确错误；官网 L1 文案 `from_extension.error_email_required`。

2. **设备上限？**  
   **推荐：** 软上限 **20** 台 / 账号；超出拒绝新注册。  
   **S1 采取：** `DEVICE_CAP_PER_USER = 20`；`issueDeviceToken` / `device-register` → `403 device_limit_reached`（不 LRU 踢旧）。

3. **升级窗口是否双栈鉴权？**  
   **推荐：** `deviceAuthOrSupabaseAuth` 维持一个发布周期。  
   **S1 采取：** **保留** dual-auth 与 `yiveno:auth_session` 读写；**不**删本批。

4. **卸载票是否保留独立 KV？**  
   **推荐：** 保留；payload `{ userId, deviceId }`；消费删 `devtok`。  
   **S1 采取：** 是——`ext_uninstall_revoke:` 仍用；消费走 `revokeDeviceById`；无票退出 → `device-revoke-self`。

5. **`user_meta` 与 Supabase `is_anonymous` 冲突时以谁为准？**  
   **推荐：** 配额/门禁以 **`user_meta` 为准**。  
   **S1 采取：** 已在 W1'/device-register 路径落地；本批未改配额 tier。

---

## 附录 A · 关键代码锚点（Step 0 实读）

| 主题                      | 路径                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Mint + 单活跃             | `worker/src/services/auth/mint-extension-session.ts`（已删除，见 S1）                                                             |
| 租约 KV                   | `worker/src/services/auth/extension-session-lease-kv.ts`（已删除，见 S1）                                                         |
| 鉴权中间件                | `worker/src/middleware/supabase-auth.ts`                                                                                          |
| Auth / AI 路由            | `worker/src/routes/auth.ts`、`ai.ts`                                                                                              |
| 扩展会话 schema           | `extension/src/core/identity/auth-session.ts`                                                                                     |
| 存取                      | `extension/src/infrastructure/identity/auth-session-service.ts`                                                                   |
| Revalidate / 闹钟 / probe | `auth-session-revalidate.ts`；`auth-session-lease-alarm.ts`（已删除，见 S1）；`extension-session-lease-probe.ts`（已删除，见 S1） |
| Handoff                   | `external-auth-handoff.ts`（core + background listener）；`website/.../extension-auth-handoff.ts`                                 |
| 反向接通                  | `website-session-from-extension.ts`；`FromExtensionAuth.vue`；`issue-supabase-user-session.ts`                                    |
| Normative                 | 产品文档 §登录态对齐；`docs/AUTH_GUIDE.md`；ADR-018 / ADR-019                                                                     |

## 附录 B · 文档落点说明

- 路径：`docs/device-token-design.md`（与 `docs/AUTH_GUIDE.md` 同级）。
- 未放入 `docs/design/`：该目录为**视觉/品牌**标准（`Yiveno-设计标准-v1.md`），非鉴权架构。
- **S1（2026-11-20）已落地：** `AUTH_GUIDE.md`、产品文档 §登录态对齐、ADR-018 §4 已改写；代码拆除租约/409/displaced；官网 Devices + cap 20。后续可另开 ADR「扩展鉴权改 device token」固化决策（本文件仍为规格权威）。
