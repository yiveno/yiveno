# 认证系统使用指南

> **最后更新：** 2026-10-31  
> **状态：** Phase C 主路径 = **官网 Supabase Auth**（Email OTP + Google / Microsoft OAuth）→ Worker **铸造**扩展独立会话 → **交接写入扩展**（步骤名 mint / handoff，见下节名词表）。  
> Worker 遗留的自建 OAuth → 自定义 JWT（`/api/auth/start|callback`）**不是**用户主路径。  
> **扩展接通流程图：** §「扩展 Session：铸造并交接」· registry `auth.extension-session-mint-handoff`（报告：[`docs/diagrams/reports/2026-10-Auth-Extension-Session图表补齐.md`](./diagrams/reports/2026-10-Auth-Extension-Session图表补齐.md)）。  
> **登录迁移门闸：** §「登录迁移门闸」· registry `auth.login-migration-gate`（报告：[`docs/diagrams/reports/2026-10-Auth-Login-Migration-Gate图表补齐.md`](./diagrams/reports/2026-10-Auth-Login-Migration-Gate图表补齐.md)）。  
> **用词：** 业内词可直用；本仓专有步骤须白话+释义（与 `.cursor/rules/dev-chinese-plain.mdc` 一致）。

## 概述

1. **用户在官网 `/login` 登录**（扩展 Settings / 头像「Sign in」只打开该页，**不**弹本机 OAuth）。
2. 登录方式（并列）：
   - **Email OTP**：输入邮箱 → Supabase 发信 → **同页邮箱框保留**，下方出现 **8 位**码输入 `verifyOtp`（邮件内 magic link 亦可落 `/auth/callback`）。位数由 Dashboard **Email OTP length** 与仓内 `EMAIL_OTP_LENGTH`（`website/src/services/auth-email.ts`）对齐，**精确匹配、无区间**。冷却未尽时刷新/后退恢复邮箱+码区；码区态邮箱只读，**换邮箱**（en：_Use a different email_；`website/src/i18n`）清 `sessionStorage` 冷却并收起码区后可换址重发。`/login` 用户可见文案经官网 `t()`（en / zh_CN）。
   - **Google / Microsoft**：Supabase `signInWithOAuth` → `/auth/callback`。
3. 若本次带接通参数 `connect_extension=1`：官网用当前 access 调 Worker `POST /api/auth/extension-session` **铸造**扩展专用会话 → 再 **交接**给扩展（`YIVENO_AUTH_SESSION_HANDOFF`）。
4. 纯官网登录（无接通参数）**不**改扩展租约；扩展靠 Connect / UI 桥接通（ADR-018 / ADR-019）。

权威行为契约：产品文档 **§登录态对齐**；身份隔离见 ADR-018；UI 桥见 ADR-019。

---

## 登录方式（用户向）

| 方式                 | UI                                                                   | 技术                                             | 大陆可达性                                                      |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| **Email OTP**        | `/login` 顶部                                                        | `signInWithOtp` + `verifyOtp({ type: 'email' })` | 高（依赖邮箱可达）                                              |
| Magic link（同邮件） | 邮件内链接                                                           | 回跳 `/auth/callback`（hash / PKCE）             | 同左；部分邮件客户端内嵌浏览器可能丢会话，故 UI **以 OTP 为主** |
| Google OAuth         | 仅 logo 按钮（与 Microsoft **并排**；`title`/`aria-label` 保留文案） | Supabase `provider: google`                      | 大陆常需翻墙                                                    |
| Microsoft OAuth      | 同上                                                                 | Supabase `provider: azure` + scopes 含 `email`   | 大陆常需翻墙                                                    |

**未上线：** 手机号短信、微信、邮箱密码。

---

## 运维清单（Email 必须）

在 **Supabase Dashboard → Authentication** 确认：

1. **Email** provider **Enabled**（允许注册 / 登录）。
2. 邮件模板（Magic Link / OTP）：Dashboard **Authentication → Emails**；权威 HTML 见 [`docs/engineering/supabase-auth-email-magic-link.html`](./engineering/supabase-auth-email-magic-link.html)（须含 **`{{ .Token }}`** + **`{{ .ConfirmationURL }}`**）。Subject 建议：`Your Yiveno sign-in code`。正文写明有效期（当前 **1 hour**），须与 Providers → Email → **Email OTP expiration**（默认 3600s）一致；改秒数时同步改模板文案。**Email OTP length**（当前 **8**）须与 `EMAIL_OTP_LENGTH` 同改。
3. Redirect URLs 含官网 `/auth/callback`（含生产与本地 `localhost`）。
4. **自定义 SMTP**：**阿里云邮件推送（DirectMail）**（按封计费，非企业邮箱席位）。发信地址须已验证域名 + 已设 SMTP 密码；Supabase **Emails → SMTP Settings** 填 DirectMail 主机（见下表）。发件显示名用 `Yiveno`（勿留 `AcuityBookmarks`）。旧 Zoho SMTP 可废弃。
5. **Captcha（必开 · Email OTP 防刷）**：Dashboard **Authentication → Attack Protection** → Enable Captcha → Provider **Turnstile** → 填 Secret。官网 `LoginForm` 渲染 Turnstile，`signInWithOtp` 传 `captchaToken`（见 `website/src/services/turnstile.ts`）。环境变量：`PUBLIC_TURNSTILE_SITE_KEY`（仅公钥，进官网 / Pages）；**Secret 只配 Supabase，禁止进 git / 官网 bundle**。Cloudflare 小组件（当前 **`yiveno-login` · region=`world`**）域名须含 `localhost`、`yiveno.com`、`yiveno.cn`（及 www）。**生命周期 / 流程图 / 国内 china 区域：** [`docs/engineering/Turnstile-Email-OTP-防刷生命周期.md`](./engineering/Turnstile-Email-OTP-防刷生命周期.md)。大陆可达性：`world` 在部分运营商下可能慢或失败 → UI 提示 Google / Microsoft 或刷新。**`region: china` 需账号 entitlement**（本仓 2026-10-27 实测创建返回 `not entitled to create widgets with this region`）；且 china/world **各有独立 secret**，而 Supabase 只收 **一个** Captcha secret → 双区域须另做 Worker 双 Siteverify，不能只换 Dashboard 里那一个 secret。

### Supabase ← 阿里云 DirectMail SMTP（标准填法）

| Supabase 字段    | 填什么                                                                      |
| ---------------- | --------------------------------------------------------------------------- |
| Sender email     | `noreply@yiveno.com`（须与控制台「发信地址」完全一致）                      |
| Sender name      | `Yiveno`                                                                    |
| Host             | `smtpdm.aliyun.com`（若控制台发信地址页写了区域专属主机，以控制台为准）     |
| Port             | `465`（SSL）                                                                |
| Username         | 完整发信地址，如 `noreply@yiveno.com`（**必须与发件人一致**）               |
| Password         | 控制台「发信地址 → 设置 SMTP 密码」里设的那串（**不是**阿里云账号登录密码） |
| Minimum interval | 可先 `60`（秒）；与 Auth rate limit、官网 UI 冷却一并调                     |

**官网重发冷却（UX）：** `LoginForm` 发码成功后将截止时间写入 **`sessionStorage`**（键 `yiveno.otpResendCooldown`，默认 **60s**，与上表对齐）。同标签**刷新 / 后退**恢复剩余秒数与 Code 区，**不**再自动发信；关标签丢弃。**换邮箱：** 码区下 **换邮箱** 链接（en：_Use a different email_；或手动改成另一地址）须 **清冷却键** 并收起码区，避免刷新又拉回旧邮箱。刷新绕不开服务端限流。实现：`website/src/services/otp-resend-cooldown.ts`。

控制台入口：[邮件推送](https://dm.console.aliyun.com/) → 开通 → **发信域名**（DNS 验证）→ **发信地址** → **设置 SMTP 密码**。

**与 Pro 欢迎信的关系：** OTP 走本表 SMTP（Supabase 代发 `noreply@`）；欢迎信由 Worker 调 DirectMail **API**（`hello@`，Secrets `ALIYUN_DM_*`）。同属 DirectMail 产品/配额，**不是**同一条发送链路。详见产品文档 §A.3 / `docs/billing.md`。

**域名建议：** 根域 `yiveno.com` 若已挂企业邮箱 / 其它 MX，优先用子域发信（如 `mail.yiveno.com` → 发件人 `noreply@mail.yiveno.com`），避免 MX/SPF 冲突；若根域仅作品牌发信且无收信邮箱冲突，可用 `yiveno.com`。DNS 以控制台「配置」页给出的 TXT/MX/DKIM/DMARC 为准。

**noreply 与回复：** DirectMail 发信地址**通常无收件能力**（用户点 Reply 往往投递失败或无人看）。OTP 模板页脚须写明 _automated / don’t reply_，并引导 **`support@yiveno.com`**（见 magic-link HTML 草稿）。不要把用户支持期望绑在 `noreply@…` 上。

未配好 Email/SMTP 时，邮箱发码主按钮（en：_Email me a code_）会失败；Google / Microsoft 不受影响。

---

## 关键代码路径

| 面                    | 路径                                                 | 职责                                                        |
| --------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| 官网登录 UI           | `website/src/components/LoginForm.vue`               | Email OTP + OAuth；connect 收尾                             |
| 官网 Auth API         | `website/src/services/auth.ts`                       | `signInWithOAuth` / `signInWithEmailOtp` / `verifyEmailOtp` |
| 邮箱格式              | `website/src/services/auth-email.ts`                 | 校验 / 规范化                                               |
| OAuth·magic link 回调 | `website/src/components/AuthCallback.vue`            | setSession / exchangeCode → 进入铸造并交接                  |
| 铸造扩展会话          | `worker/src/services/auth/mint-extension-session.ts` | 独立 refresh；须有 email（代码模块名含 mint）               |
| 扩展接收并写入会话    | `extension/.../external-auth-handoff.ts`             | 校验后写入；**不**发起 OAuth（交接 handoff）                |

---

## 环境变量（相关）

见 `docs/ENVIRONMENT.md`。

- 官网：`PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`
- 遗留 Worker OAuth（非主路径）：`AUTH_GOOGLE_*` / `AUTH_MICROSOFT_*` / `JWT_SECRET` / `REDIRECT_URI_ALLOWLIST`

---

## 常见问题

### Q: 为什么不在扩展里弹 Google 登录？

A: 产品规定官网为唯一用户向登录壳；扩展只接收**交接写入**的独立会话（避免 chrome.identity 主路径与双会话契约冲突）。

### Q: 中国用户怎么登录？

A: 用 **Email OTP**（可达邮箱）。Google / Microsoft 在大陆常不可用，仍保留给海外用户。

### Q: 同一邮箱先 Google 再 Email 会怎样？

A: **自动关联（Automatic linking）默认始终开启，Dashboard 没有开关可关**（官方文档 + 社区确认）。同一**已验证**邮箱的 Google / Email OTP / Microsoft 会落到**同一个** `auth.users` 行。Dashboard 里能看到的是 **Allow manual linking**（`GOTRUE_SECURITY_MANUAL_LINKING_ENABLED` / 本地 `enable_manual_linking`）——那是给**不同邮箱**在已登录态用 `linkIdentity()` 手动绑身份用的，与「同邮箱自动合并」无关；本仓默认关、产品面也不做跨 provider 人工合并 UI。

### Q: 铸造扩展会话为什么要求 email？

A: Worker 用 Admin magiclink 路径铸造扩展会话；无 email → `email_required`。故新身份提供方也须产出带 email 的用户（或先改铸造契约）。

---

## 扩展 Session：铸造并交接（官网 → 扩展）

> **范围：** 已有**官网**登录会话之后，如何**新造一套扩展专用登录会话**并写入扩展本机。  
> **不含：** Cloudflare Turnstile / OTP / OAuth 建立官网会话（见 `turnstile.*`）；扩展→官网反铸 `website-session`；登录迁移门闸（见下节 `auth.login-migration-gate`）；Pro 云同步；遗留「官网退出顺带踢扩展」路径（新产品路径**不**踢）。  
> **安全铁律（代码 + Normative 一致）：** 扩展持有**独立** refresh；**禁止**把官网 refresh 直接塞进扩展；Connect ≠ Sign in；access / refresh / 作废票 / 交接载荷**勿混为同一凭证**。

### 读图名词（业内通用 vs 本仓专有）

| 说法                           | 归类                                                | 含义                                                                         |
| ------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| **session / access / refresh** | 业内（OAuth/OIDC 常见）                             | 登录会话；短命访问令牌；长命刷新令牌                                         |
| **OTP / OAuth / Bearer**       | 业内                                                | 邮箱一次性码；第三方登录；HTTP `Authorization: Bearer …`                     |
| **409**                        | 业内（HTTP）                                        | 冲突；此处表示「他端扩展会话占着，需确认是否挤掉」                           |
| **幂等**                       | 业内                                                | 再做一次结果不变；此处 = 扩展已登录则不再铸造                                |
| **Turnstile**                  | **产品名**（Cloudflare）                            | 官网发码前的人机验证组件，**不是**通用鉴权步骤名                             |
| **铸造（mint）**               | 业内偶用「mint a token」；**本仓步骤名**            | Worker **新造**扩展专用会话（独立 refresh 族），不是拷贝官网会话             |
| **交接（handoff）**            | 英语常义；**本仓协议步骤**                          | 官网把刚铸好的扩展令牌交给扩展写入本地（消息 `YIVENO_AUTH_SESSION_HANDOFF`） |
| **探测登录态**                 | **本仓消息**（代码里常叫 `STATUS_PROBE`）           | 官网问扩展：是否已登录、是哪个用户；兼唤醒 Service Worker                    |
| **挤掉他端 / 收回租约**        | **本仓策略**（代码 `displace` / `LEASE_RECLAIM_*`） | 同一账号扩展侧通常单活跃；确认后撤销旧扩展会话再铸造                         |
| **作废票**                     | **本仓字段**（`uninstallRevokeToken`）              | 卸载或交接失败时一次性作废刚铸会话；**不是** refresh                         |
| **静默并库**                   | **本仓禁语**（旧实现曾称 absorb）                   | 登录后偷偷把本机摘录并进账号——**已禁止**，改走迁移门闸                       |
| **接通参数**                   | **本仓 URL 查询串**（`connect_extension=1`）        | 标记「这次官网登录是为了接通扩展」；没有则只登官网                           |
| **UI 桥**                      | **本仓**（ADR-019 · `chrome.runtime` Port）         | 同浏览器官网页↔扩展的编排通道；**禁止**传 token                              |

凭证分工（读图前先分清）：

| 凭证                                           | 谁持有                             | 用途                                            |
| ---------------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| 官网 `access_token`                            | 官网 Supabase 会话                 | 仅作 Worker 铸造接口的 Bearer；**不**写入扩展   |
| 扩展 `access_token` + **独立** `refresh_token` | 扩展 `chrome.storage.local`        | 交接写入；扩展日后刷新 / 调 API                 |
| 作废票 `uninstallRevokeToken`                  | 铸造响应 → 交接旁路登记 / 失败回滚 | 一次性销扩展会话 + 服务端租约；**不是** refresh |
| UI 桥 Port 消息                                | 同浏览器编排                       | **禁止**传任何 token（ADR-019）                 |

<!-- diagram: id=auth.extension-session-mint-handoff kind=flowchart status=implemented -->

```mermaid
flowchart TD
  Start([需要把官网账号接到扩展]) --> Entry{入口?}

  Entry -->|扩展 Sign in| OpenLogin[打开登录页<br/>带接通扩展参数]
  OpenLogin --> WebLogin[用户 OTP/OAuth → 官网已登录<br/>发码前人机验证见 Turnstile 图]
  WebLogin --> MintGate

  Entry -->|扩展 Connect<br/>官网已登录| ExtSess{扩展本地是否已有会话?}
  ExtSess -->|是| IdemOk[直接成功 · 幂等 · 不再铸造]
  ExtSess -->|否| PortQ{同浏览器 UI 桥<br/>约 2s 内有应答?}
  PortQ -->|有| Bridge[桥消息请官网页发起接通<br/>不传 token]
  PortQ -->|无| OpenAcct[打开账户页<br/>带接通扩展参数]
  Bridge --> MintGate
  OpenAcct --> MintGate

  MintGate{{进入铸造并交接<br/>须浏览器临时接通标记<br/>禁止仅凭上次扩展 id 静默重铸}}
  MintGate --> Probe[探测扩展登录态<br/>并唤醒扩展后台]
  Probe --> SameUser{扩展已是同一用户?}
  SameUser -->|是| SkipMint[跳过铸造 · 清临时标记<br/>记下扩展 id]
  SameUser -->|否| MintReq[请求 Worker 铸造扩展会话<br/>用官网 access 作 Bearer<br/>不得用官网 refresh]

  MintReq --> MintRes{铸造结果?}
  MintRes -->|失败<br/>如缺邮箱等| NoHandoff[不交接<br/>禁止把官网 refresh 塞进扩展]
  MintRes -->|409 需确认挤掉| Reclaim[探测本机能否收回旧扩展租约]
  Reclaim --> Orphan{本机孤儿租约可收回?}
  Orphan -->|是| ConfirmMint[确认挤掉后再次铸造<br/>先硬撤旧扩展会话]
  Orphan -->|否 · 他端占用| AskUser{用户确认挤掉他端?}
  AskUser -->|确认| ConfirmMint
  AskUser -->|取消| AbortDisp[Connect：只清临时标记 · 留官网登录<br/>Sign in：可中止并退回登录页]
  ConfirmMint --> MintRes2{再次铸造?}
  MintRes2 -->|失败| NoHandoff
  MintRes2 -->|成功| Tokens
  MintRes -->|成功| Tokens[得到扩展 access + 独立 refresh<br/>及可选作废票]

  Tokens --> Handoff[交接：把扩展令牌发给扩展写入<br/>先探测/唤醒后台 · 超时约 8s · 可短重试]
  Handoff --> HofOk{交接成功且用户一致?}
  HofOk -->|是| Write[写入扩展本地存储<br/>会话 + 账号绑定<br/>租约闹钟等<br/>禁止静默并库]
  Write --> BridgeOk[若经 UI 桥 Connect<br/>回告官网接通成功]
  BridgeOk --> Alive[之后扩展用自有 refresh 续命<br/>与官网会话生命周期独立]
  HofOk -->|否| Rollback[用作废票回滚刚铸的会话/租约]

  NotePure[纯官网登录页<br/>不带接通参数 → 不进本图]
  Start -.-> NotePure
```

**入口对照（勿混）：**

| 入口       | 代码路径（对照实现）                                            | 何时用                                     |
| ---------- | --------------------------------------------------------------- | ------------------------------------------ |
| Sign in    | `AUTH_SIGN_IN` → `/login?connect_extension=1`                   | 扩展**未**登录；须用户在官网完成 OTP/OAuth |
| Connect    | `AUTH_CONNECT_WEBSITE` → UI 桥或 `/account?connect_extension=1` | 官网**已**登录；**禁止**先开登录壳         |
| 纯官网登录 | `/login` 无接通参数                                             | **不**铸造、**不**改扩展租约               |

**故意不画进本图：** 扩展→官网反铸会话；登录迁移三选一（下节）；云同步门禁；卸载落地页全时序（仅涉及作废票回滚边）。

---

## 登录迁移门闸（无主摘录 · ADR-018）

> **范围：** 扩展**已**绑定账号之后，如何识别「未登录期间写在本地档的摘录」，以及用户 Import / Export / Delete 对归属的后果。  
> **不含：** 上节「铸造并交接」；**静默并库**（旧称 absorb，**已拆除**）；外账号脏数据清理（Settings 旁路）；云同步对齐（ADR-017 · `sync.excerpt-cloud-pro-gate`）。  
> **无主定义（代码 = Normative）：** 仅本地档 `localProfileId` 上的 `text_excerpt`（盘点看未软删；Export/Delete 可含软删）；**不**扫描其它账号桶。

**读图小词：**

| 说法       | 含义                                                             |
| ---------- | ---------------------------------------------------------------- |
| **本地档** | 未登录身份桶 `localProfileId`                                    |
| **账号桶** | 当前登录 `accountId`                                             |
| **改归属** | 把条目的 `ownerId` 从本地档改到账号（代码 `remapOwnerIdByType`） |
| **待处理** | 门闸 `pending=true`（仍有无主摘录）                              |

**触发：** Side Panel / Settings 在已登录时查询迁移状态（`GET_LOGIN_MIGRATION_STATUS`）。**不是**交接写入扩展时内联弹窗。无账号绑定、或本地档无未软删摘录 → 不弹窗。

**主弹窗关闭策略：** 不能 Esc、无关闭钮、点遮罩不关——必须三选一。**不存在**「取消 = 拒绝迁移」主按钮。

<!-- diagram: id=auth.login-migration-gate kind=flowchart status=implemented -->

```mermaid
flowchart TD
  Start[扩展已登录<br/>Side Panel / Settings 刷新] --> StatusCall[查询是否需迁移门闸]
  StatusCall -->|失败 / 异常| Silent[不弹窗 · 不阻断主界面]
  StatusCall -->|成功| Bind{已绑定账号?}
  Bind -->|否| NoGate[不弹窗]
  Bind -->|是| Scan[读取本地档条目<br/>不含已软删]
  Scan --> Exc{未软删摘录数 > 0?}
  Exc -->|否| NoGate
  Exc -->|是| Gate[强制门闸弹窗<br/>禁 Esc / 遮罩关闭<br/>展示摘录数 + 本地档书签数]

  Gate --> Imp[导入到当前账号]
  Gate --> Exp[导出备份]
  Gate --> Del[删除]

  Imp -->|成功| RemapE[摘录改归属 → 当前账号]
  Imp -->|执行失败| Err[显示错误 · 主窗不关]
  RemapE --> RemapB[同档书签一并改归属<br/>本机连续 · 不上云]
  RemapB --> DoneImp[关主窗 · 不再待处理]

  Exp -->|成功| Dump[下载 JSON<br/>含软删摘录 · 不改归属]
  Exp -->|执行失败| Err
  Dump --> Ask{删除未导入的本地副本?}
  Ask -->|保留副本| Stay[关二次确认 · 主门闸仍开<br/>仍待处理]
  Ask -->|确认删除| DelPath

  Del -->|成功| DelPath[清掉本地档全部摘录含软删<br/>保留书签]
  Del -->|执行失败| Err
  DelPath --> DoneDel[关主窗与二次确认]
  Err -.->|主窗仍开| Gate

  NoteOrphan[其它账号残留数据<br/>不进本门闸]
  Scan -.-> NoteOrphan
  NoteCloud[导入 ≠ 上云<br/>上云仍须 Pro + 同步开关]
  RemapB -.-> NoteCloud
```

**三选一后果（勿合并）：**

| 用户动作                            | 摘录归属                                   | 本地档书签                               | 弹窗                          |
| ----------------------------------- | ------------------------------------------ | ---------------------------------------- | ----------------------------- |
| **导入**                            | 本地档 → 当前账号（含软删一并改归属）      | 一并改到账号桶（本机可召回；**不上云**） | 成功关主窗                    |
| **导出**                            | **不变**；下载备份 JSON                    | 不动                                     | 主窗仍开；再问是否删除        |
| **导出 → 保留副本**                 | 仍无主                                     | 不动                                     | 主窗继续挡（仍待处理）        |
| **导出 → 确认删除** 或直接 **删除** | 本地档摘录清除（含软删）；**不做内容去重** | 保留                                     | 关窗                          |
| **失败**                            | 不变                                       | 不变                                     | 主窗不关 + 错误文案           |
| **「取消主窗」**                    | —                                          | —                                        | **未实现**（无 Esc/无关闭钮） |

账号交接成功路径只强调「禁止静默并库」；**真正弹窗**靠上述界面刷新，与 `auth.extension-session-mint-handoff` **分图**。
---

## 相关文档

- [Yiveno 产品文档 v4.0](./product/Yiveno-产品文档-v4.0.md) §登录态对齐
- [ADR-018](./architecture/decisions/ADR-018-account-profile-data-isolation.md)
- [ADR-019](./architecture/decisions/ADR-019-website-extension-ui-bridge.md)
- [ENVIRONMENT](./ENVIRONMENT.md)
- [图表 registry](./diagrams/registry.json) · `auth.extension-session-mint-handoff` · `auth.login-migration-gate`
