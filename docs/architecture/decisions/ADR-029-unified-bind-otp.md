---
created: 2026-11-22T14:07:51+08:00
updated: 2026-11-22T14:07:51+08:00
author: agent:cursor
scope: docs/architecture/decisions
status: 已接受
upstream: ADR-028；ADR-018；docs/device-token-design.md；docs/AUTH_GUIDE.md
downstream: Worker bind-code / bind-verify / promote / claim-by-otp；扩展 BIND_* + CONVERT_ANONYMOUS_ACCOUNT；AUTH_GUIDE 统一绑定章
---

# ADR-029: 统一绑定 OTP（验邮箱归属后分叉 promote / claim）

- **状态：** 已接受（V1–V3 实现已接线；本 ADR 固化决策）
- **日期：** 2026-11-22
- **决策者：** 维护者（统一绑定 · 文档收尾）
- **前置：** ADR-028（匿名试用 + device token）；ADR-018（登录迁移门闸）

## 背景

ADR-028 曾**接受**「转正不验邮箱归属」：扩展持匿名 device 会话调用 `POST /api/auth/promote`，Worker 直接 Admin `updateUserById` 绑邮箱。任意设备持有者可绑任意邮箱并占住该邮箱；真正主人日后经官网 Email OTP / OAuth 登录会落到**占住者的 `userId`**（自动关联同邮箱）。正式登录仍须 OTP，口子影响有限——但绑定路径本身仍可被滥用占邮箱。

统一绑定要关掉这条口子：**先证明邮箱归属，再决定是原地升级还是认领已有账号**。

## 决定

1. **验码后分叉（同一套 OTP 门面）：**
   - 邮箱**未**注册 → **promote**：同一 `userId` 原地绑邮箱，`user_meta.isAnonymous` 翻转；**同一 device token 继续有效**。
   - 邮箱**已**注册 → **claim**：为目标账号签发**新** device token；旧匿名 token **best-effort 撤销**（失败不阻塞）；本机会话切换到目标账号，并走 ADR-018 迁移门闸（**不**新建合并策略、**不**静默并库）。

2. **四端点（均 `deviceAuth`）：**
   - `POST /api/auth/bind-code` — 发 8 位 OTP（DirectMail）；响应**不**透露邮箱是否已存在。
   - `POST /api/auth/bind-verify` — 验码；成功签发一次性 **claimToken**（KV，绑定 `anonUserId` + email + `branch`）。
   - `POST /api/auth/promote` — **必填** `claimToken`，且记录 `branch` 必须为 `promote`；消费后走原 Admin 绑邮箱。
   - `POST /api/auth/claim-by-otp` — **必填** `claimToken`，且 `branch` 必须为 `claim`；邮箱**只**从 claim 记录读取，Admin 复核目标用户后签发 device。

3. **D1–D6（定值）：**
   - **D1：** OTP 为 **8** 位数字；码以 SHA-256 存 KV，TTL **600s**；验码最多 **5** 次。
   - **D2：** 发码 Turnstile **fail-closed**（缺 token / 校验失败 / Worker 缺 `TURNSTILE_SECRET_KEY` → 不发码；缺 secret → **503** `captcha_not_configured`）。与匿名 signup「拿不到 captcha → fail-open 保持未登录」对照：绑定是主动敏感动作，宁可挡死。
   - **D3：** claim 成功后扩展侧 **best-effort** 撤旧匿名 device token；Worker claim 路径不负责撤旧会话。
   - **D4：** 发码限流四档——同邮箱 **60s** 冷却；每邮箱 **5**/小时；每设备 **10**/天；每 IP **30**/天（缺 `CF-Connecting-IP` 时跳过 IP 维）。
   - **D5：** **无兼容期**——旧无 `claimToken` 的 promote 调用 → **401** `invalid_claim`。
   - **D6：** 绑定 OTP 邮件走 Worker **DirectMail API**（与官网登录 OTP 的 Supabase→SMTP 链路分立）。

4. **扩展 UX：** Settings 试用区与 Side Panel 内联共用状态机（`idle` → `code_sending` → `code_sent` → `verifying` → `confirming` → `success` | `error`）；**60s** 重发冷却；换邮箱废弃当前码态。后台消息：`BIND_REQUEST_CODE` / `BIND_VERIFY_CODE` / `CONVERT_ANONYMOUS_ACCOUNT({ email, claimToken, branch })`。发码拿不到 Turnstile → fail-closed，前景可重试。

## 不做

- 不新建「匿名库 ↔ 已有账号」自动合并；claim 后迁移门闸复用 ADR-018。
- 不恢复试用区「去登录合并」常显入口（V3 已删）；匿名态隐藏退出登录（AN7 该点）**保留**。
- 不为绑定 OTP 单独开第二套 Turnstile 产品叙事；与官网登录 captcha 共用站点钥，但 Worker 侧 siteverify 策略与匿名 signup fail-open **分计**。

## 后果

- 旧客户端 / 脚本直调 `promote` 且无有效 claimToken → **401**；须走 bind-code → bind-verify → promote/claim。
- claim 会话写入与官网 handoff 匿名覆盖共用 `applyIncomingDeviceSession`；换账号后 UI 刷新迁移门闸。
- 运维须为 Worker 配置 `TURNSTILE_SECRET_KEY` 与 DirectMail（`ALIYUN_DM_*`）；缺 Turnstile secret 时发码 **503**，试用绑定不可用。
- 文档：`AUTH_GUIDE` 统一绑定章；消息注册表补 `BIND_*`；产品文档 §登录态对齐中「不发 OTP / 接受归属口子」句由本 ADR **取代**（实现已接线，Normative 句须随批外同步扫净）。

## Supersedes

- **取代** ADR-028 决定第 6 条 / 设计稿「转正不验邮箱归属（不发 OTP）」定值（原「接受邮箱归属口子」）——转正与认领**必须**先经绑定 OTP。
- **部分取代** `docs/device-token-design.md` §6「Confirm email OFF → 当场绑邮箱、不发 OTP」——§6 的「同 userId、token 继续有效、409 冲突」在 **promote 分支**仍成立，但前置改为 claimToken；**邮箱已占用**改为走 **claim** 分支，而非仅引导「去登录合并」。
- **AN7：** 「试用区常显去登录合并」已被 V3 删除（统一绑定双入口取代）；**匿名态隐藏退出登录**仍有效，本 ADR 不改。
