# ADR-019: 同浏览器官网 ↔ 扩展 UI 状态桥（Port）

- **状态：** 已接受
- **日期：** 2026-10-15
- **决策者：** 产品 / 工程

## 背景

官网与扩展是两套会话（mint + handoff），UI 态（是否显示 Connect、头像/展示名）若只靠「打开 Panel 再探测」会滞后。需要同浏览器内**近实时**同步登录相关 UI，并预留资料（头像/昵称）变更；**不**为此上云 Realtime，也**不**双边定时轮询。

## 决定

### 1. 通道 = `chrome.runtime` 长连接 Port（同浏览器）

- 官网页：`chrome.runtime.connect(extensionId, { name: 'yiveno-ui-bridge' })`
- 扩展 SW：`chrome.runtime.onConnectExternal`
- 消息闭集 + Zod（`channel: yiveno_ui_bridge` / `v: 1`）；**禁止**经 Port 传 access/refresh token
- 登录铸会话仍走既有 `YIVENO_AUTH_SESSION_HANDOFF`（mint）；本桥只服务 **UI 态与资料镜像**

### 2. 可见性门禁（UI 更新专用）

- **目的是 UI**：Side Panel / 官网 tab **不可见时不强制刷 DOM**
- 官网：`document.visibilityState !== 'visible'` 时不主动 `postMessage`（可记脏，回前台再发）
- 扩展：收到桥消息可写入 `chrome.storage.session`；Panel 可见时再读存储刷新 Connect / 头像
- **不**要求 tab/Panel 不可见时仍推云端或唤醒无意义工作

### 3. 事件闭集（可增不可私开）

| 方向        | type                        | 用途                                                                    |
| ----------- | --------------------------- | ----------------------------------------------------------------------- |
| 官网 → 扩展 | `website_auth_changed`      | `{ signedIn, userId? }` → Connect 软条等                                |
| 官网 → 扩展 | `website_profile_changed`   | `{ userId, displayName?, avatarUrl? }` → 补本地 session 展示字段        |
| 扩展 → 官网 | `extension_auth_changed`    | `{ signedIn, userId?, displayName?, avatarUrl? }` → 官网 Nav/账户 UI    |
| 扩展 → 官网 | `request_extension_connect` | `{ extensionId }` → 已登录零导航 Connect（mint 仍在官网；**无 token**） |
| 官网 → 扩展 | `website_connect_ack`       | 已接手本次 Connect                                                      |
| 官网 → 扩展 | `website_connect_result`    | `{ status: ok\|cancelled_displace\|failed\|no_session\|busy }`          |
| 双向        | `bridge_hello`              | 握手；连接后各方可推当前快照                                            |

### 4. 明确不做

- 云端 WebSocket / Supabase Realtime 作本桥主路径（多设备另案）
- 双边 `setInterval` / alarm 互探当主同步
- 用 Port 替代 mint handoff 或共享 refresh

## 后果

- 实现：`extension/src/core/identity/ui-bridge-messages.ts` + `background/listeners/ui-bridge.ts`；官网 `website/src/services/ui-bridge.ts` + `run-extension-connect.ts`
- 产品文档 §登录态对齐补「UI 桥」Normative
- Connect 软条：听 `website_auth_changed`（登出写 `signedIn:false` 否态行，勿删键）；**无桥行**时打开 Panel 仍可 probe 兜底
- **已登录 Connect：** 扩展 `AUTH_CONNECT_WEBSITE` → 广播 `request_extension_connect`；官网 `UiBridgeHost` 原地 mint；无 ack → `/account?connect_extension=1`；**禁止**已登录路径打开 `/login` 登录壳
- **扩展→官网 Open account：** 不走本桥传 token；走 `/auth/from-extension` + `YIVENO_WEBSITE_SESSION_REQUEST`（sendMessage）+ Worker `website-session`；桥仅在官网 `setSession` 后推 `website_auth_changed`
- 资料编辑上线后发 `website_profile_changed`，扩展可见时无缝换头像/昵称

## 拒绝的替代

| 方案           | 原因                                            |
| -------------- | ----------------------------------------------- |
| 仅聚焦再 probe | 不够「官网一退 Connect 马上没」；且难扩资料同步 |
| 云端总线       | 超出同浏览器 + UI 范围；成本高                  |
| 定时互探       | 空转、SW 噪音、复杂度高                         |
