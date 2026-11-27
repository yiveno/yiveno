---
created: 2026-11-20T21:04:08+08:00
updated: 2026-11-28T00:37:00+08:00
author: agent:cursor
scope: docs/architecture/decisions
status: 已接受
upstream: docs/device-token-design.md；docs/AUTH_GUIDE.md；docs/product/Yiveno-产品文档-v4.0.md（§登录态对齐）
downstream: worker anonymous-cleanup cron；device-register / promote / dual-auth；扩展 yiveno:device_session
---

# ADR-028: 匿名认证（方案 C）+ 设备 token（D）+ 超期清理

- **状态：** 已接受
- **日期：** 2026-11-20
- **决策者：** 维护者（账号体系重构 · O1 收尾）
- **前置：** ADR-018 / ADR-019；设计稿 `docs/device-token-design.md`

## 背景

需要扩展冷启动即可试用托管 LLM / embedding，同时避免「扩展长期持 Supabase 匿名会话 + 单活跃租约」的复杂度与多机冲突。Supabase 不自动清理 `is_anonymous` 用户；长期不活跃匿名行占用 MAU 与配额 key。

## 决定

1. **匿名试用 = 方案 C：** 扩展经 GoTrue 匿名 signup → `POST /api/auth/device-register`（`mode=session_exchange`）换 **device token**；业务凭证只持久化 `yiveno:device_session`。**AN1：** signup↔exchange 间可将待交换匿名会话落 `yiveno:pending_anon_session`（复用同一用户、过期先 refresh）；仍禁止写 legacy `yiveno:auth_session`，且待交换会话不得调 AI。**AN2：** exchange 系统性 401 不删 pending，写独立熔断键 `yiveno:anon_exchange_401_backoff`（60 分钟窗口内不 signup / 不 exchange；`ignoreBackoff` 可绕过）；Worker `getClaims` 失败记 `[VerifySupabase]` 诊断日志（claims 摘要，不含 token 全文）。**AN2.1：** device 会话建立时（handoff 成功 / ensure 已有会话）清熔断，避免 Connect 后退出仍被 stale 熔断挡住。**AN3：** 匿名 token 的 `email: ""` 视同无邮箱；claims 校验拒绝记 `[VerifySupabase]` 诊断（getClaims 成功但 Zod/role 拒时亦有观测）。**AN5：** Connect handoff 匿名豁免——扩展当前为匿名会话时，官网真实账号 handoff 直接覆盖（匿名是占位非真实账号）；真实账号间仍硬拒 `account_mismatch`。官网 probe 亦豁免（响应带 `isAnonymous` 字段）。`AUTH_CONNECT_WEBSITE` 不得把匿名当 `alreadySignedIn` 短路；异账号 UI 提示对匿名豁免。**AN6（2026-11-22）：** 设备注册填 `deviceLabel`（`"{浏览器} on {OS}"`，例 `Chrome on macOS`）与 `platform`（OS，例 `macOS`）；扩展 `session_exchange` 与官网 `website_connect` 两路均传；Worker 早已支持（`issueDeviceToken` 默认值 `Unknown device` / `unknown` 仅作兜底）。**AN7（2026-11-22）：** 匿名态设置页隐藏退出登录（匿名无账号可退；退出后自动重建匿名会话，按钮是空转循环）；试用区常显去登录合并，绑定邮箱（升级试用）与登录已有账号两条路径 upfront。
2. **配额：** 匿名档 LLM **15** 次 lifetime（`ai_usage_lifetime:{userId}`）；embeddings **前 30** 次 lifetime（`embed_anon:{userId}`）。转正**不**重置计数器。
3. **Turnstile B'：** 官网登录只出 captcha token（打在 Email OTP）；Worker **不**持 Turnstile secret；匿名 signup 路径不经 Worker 验 captcha。
4. **放弃「Admin mint 匿名」：** Spike 证实 Admin `generateLink` / `createUser` 要求邮箱，无法无邮箱建匿名号。匿名只走扩展 signup + `session_exchange`。
5. **D 架构：** 扩展持 opaque device token（`ydt_`）；`deviceAuth` 只读 KV；官网 JWT 与 device Bearer 双栈。转正 = `POST /api/auth/promote`（Admin 绑邮箱，**同 userId**，device token **继续有效**）；`user_meta.isAnonymous` 翻转为 false。
6. **§5.4 邮箱归属口子（接受）：** Confirm email **OFF**；转正不验邮箱归属（不发 OTP）。正式登录仍须 Email OTP / OAuth，影响有限；邮箱冲突 → `409 email_conflict` 引导登录合并。
7. **清理策略：** 每周日 UTC 03:00 cron；对象 = `is_anonymous=true` 且（`last_sign_in_at` 超 **90** 天，或从未登录且 `created_at` 超 90 天）；已转正永不入选。删除前先撤该用户全部 device token / `user_meta` / 匿名配额 key，再 Admin `deleteUser`。每轮上限 **500**。默认 **dry-run**（`ANON_CLEANUP_DRY_RUN` 未设或非 `'false'`）；先跑约两周只记日志，确认删除集后再显式关 dry-run。匿名行无云端业务数据，删除前不备份；本机数据不受影响。

## 不做

- 不改配额数值、转正流程契约、dual-auth 与 `yiveno:auth_session` 迁移窗（本 ADR 只钉决策，实现分批已/将接线）。
- 不为「断网找开放页」或离线匿名扩 sprint。
- 不把内容别名灰名单写入召回。

## 后果

- 运维须部署含 `0 3 * * SUN` trigger 的 Worker（Cloudflare Quartz 星期，勿用 unix `0`）；真删前核对 dry-run 日志。
- 文档：`AUTH_GUIDE` 匿名生命周期；产品文档 §登录态对齐；实现 `worker/src/services/auth/anonymous-cleanup.ts`。
