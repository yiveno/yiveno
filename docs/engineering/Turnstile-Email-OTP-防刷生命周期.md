---
title: Turnstile Email OTP 防刷 · 生命周期与流程图
created: 2026-10-27 18:51 +0800
updated: 2026-10-27 19:50 +0800
author: agent:cursor
scope: website Email OTP · Cloudflare Turnstile · Supabase Attack Protection · 国内可达性
status: active
upstream:
  - docs/AUTH_GUIDE.md
  - docs/ENVIRONMENT.md
  - docs/product/Yiveno-产品文档-v4.0.md（§登录态 · Captcha Normative）
downstream:
  - website/src/services/turnstile.ts
  - website/src/components/LoginForm.vue
  - website/src/services/auth.ts
  - Cloudflare Turnstile 小组件 yiveno-login（world）
  - Supabase Authentication → Attack Protection
---

# Turnstile · Email OTP 防刷生命周期与流程图

> 开发者资料（非产品 UI 文案）。说明官网「邮件验证码登录」如何与 Cloudflare Turnstile、Supabase Auth 串起来，以及 **国内可达 / china 区域** 的约束与后续路径。

## 1. 角色一览

| 角色                 | 是什么                         | 手里有什么                                                     |
| -------------------- | ------------------------------ | -------------------------------------------------------------- |
| **Turnstile 小组件** | Cloudflare 账号级 bot 挑战实例 | **sitekey**（公开）+ **secret**（保密）；`region` 创建后不可改 |
| **官网 `/login`**    | 渲染部件、拿 token、调发码     | 仅 sitekey（`PUBLIC_TURNSTILE_SITE_KEY`）                      |
| **Supabase GoTrue**  | 校验 token 后才发 OTP 邮件     | Dashboard 里配置的 **单个** Turnstile secret                   |
| **DirectMail SMTP**  | 真正投递邮件                   | 与 Captcha 无关；Captcha 管「谁配发」                          |

当前生产小组件（world）：

| 项      | 值                                                                                              |
| ------- | ----------------------------------------------------------------------------------------------- |
| 名称    | `yiveno-login`                                                                                  |
| sitekey | `0x4AAAAAADQljXtogaNU8cqP`                                                                      |
| region  | `world`（默认）                                                                                 |
| 主机名  | `localhost` · `yiveno.com` · `www.yiveno.com` · `yiveno.cn` · `www.yiveno.cn`                   |
| 模式    | Managed（托管）+ 客户端 `appearance: interaction-only`（默认不露 Success 条；高风险才可见挑战） |

---

## 2. `captchaToken` 生命周期

```mermaid
sequenceDiagram
  autonumber
  participant U as 用户浏览器
  participant W as 官网 LoginForm
  participant CF as Cloudflare Turnstile
  participant SB as Supabase Auth
  participant SMTP as DirectMail

  U->>W: 打开 /login
  W->>CF: 加载 api.js + render(sitekey)
  CF-->>W: 挑战 UI / 静默校验
  CF-->>W: callback(token)  ※ 签发
  Note over W: captchaToken 存活 ≤ ~300s<br/>且原则上单次使用

  U->>W: 填邮箱 → Email me a code
  W->>SB: signInWithOtp({ email, captchaToken })
  SB->>CF: Siteverify(secret, token)  ※ 校验+作废
  alt success
    CF-->>SB: success=true
    SB->>SMTP: 发含 {{ .Token }} 的邮件
    SB-->>W: ok
    W->>W: reset() Turnstile  ※ 清本地 token
    W->>W: sessionStorage 写重发截止（默认 60s）
    W-->>U: 展示 Code 输入 / Resend 倒计时
    Note over W: 同标签刷新恢复剩余秒；不自动再发
  else fail / 过期 / 已用
    CF-->>SB: success=false
    SB-->>W: captcha_failed 等
    W->>W: reset() + 提示改 Google/Microsoft
  end

  U->>W: 输入 EMAIL_OTP_LENGTH 位码（当前 8）
  W->>SB: verifyOtp({ email, token, type: email })
  Note over SB: 验码不再强制 Captcha
  SB-->>W: session
```

### 状态机（token）

```mermaid
stateDiagram-v2
  [*] --> Absent: 页加载 / reset / 过期回调
  Absent --> Pending: render 开始挑战
  Pending --> Issued: callback(token)
  Pending --> Absent: error-callback / 加载失败
  Issued --> Absent: expired-callback（~5min）
  Issued --> Consumed: Supabase Siteverify 成功
  Issued --> Rejected: Siteverify 失败（伪造/重放/错 secret）
  Consumed --> Absent: LoginForm.reset()
  Rejected --> Absent: LoginForm.reset()
  note right of Issued
    本地 ref captchaToken
    未校验前可被重放请求
    故必须服务端 Siteverify
  end note
```

---

## 3. 端到端流程图（含配额层）

```mermaid
flowchart TD
  A[用户打开 /login] --> B{PUBLIC_TURNSTILE_SITE_KEY<br/>已配置?}
  B -->|否| B1[提示 bot check 未配置<br/>引导 Google / Microsoft]
  B -->|是| C[渲染 Turnstile world 小组件]
  C --> D{挑战成功?}
  D -->|否/超时/国内脚本失败| D1[UI 提示改用 OAuth<br/>或刷新重试]
  D -->|是| E[持有 captchaToken]
  E --> F[用户提交邮箱]
  F --> G{邮箱格式合法<br/>且有 token?}
  G -->|否| F
  G -->|是| H[signInWithOtp + captchaToken]
  H --> I{Supabase Attack Protection<br/>Siteverify}
  I -->|失败| D1
  I -->|成功| J{Auth Rate Limits<br/>发信配额 / 同邮箱间隔}
  J -->|超限| J1[可读错误 · 稍后重试]
  J -->|通过| K[DirectMail 投递 OTP 邮件]
  K --> L[同页保留邮箱 + Code 框]
  L --> M[verifyOtp]
  M --> N[官网 session → mint/handoff 等]
```

三层分工：

| 层               | 挡什么                          |
| ---------------- | ------------------------------- |
| Turnstile        | 无头浏览器 / 批量脚本过发码入口 |
| Auth Rate Limits | 真人/半自动刷爆发信             |
| SMTP 配额        | 阿里云侧硬顶                    |

---

## 4. 密钥与环境（勿混）

```mermaid
flowchart LR
  subgraph Public["可进 git 模板 / 官网 bundle"]
    SK[PUBLIC_TURNSTILE_SITE_KEY<br/>sitekey]
  end
  subgraph Secret["禁止进 git / 禁止进官网"]
    SEC[Turnstile secret<br/>仅 Supabase Attack Protection]
  end
  SK --> LoginForm
  LoginForm -->|captchaToken| GoTrue
  SEC --> GoTrue
  GoTrue -->|Siteverify| CFAPI[challenges.cloudflare.com/siteverify]
```

| 环境             | sitekey 去向                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| 本机             | `.env.shared.local` → `bun run env:sync:dev` → `website/.env`                                      |
| Cloudflare Pages | `yiveno-website` production/preview 环境变量 `PUBLIC_TURNSTILE_SITE_KEY`（**下次部署**才进静态包） |

---

## 5. 国内访问与 `region: china`（决策与现状）

### 5.1 问题

`world` 小组件脚本与挑战走 `challenges.cloudflare.com`。部分国内网络慢、超时或失败 → 用户无法拿到 `captchaToken`，Email OTP 入口不可用（OAuth 亦常不可用，故体验更痛）。

### 5.2 Cloudflare 能力

- API 允许创建时设 `region: "world" | "china"`，**创建后不可改**。
- **china 与 world 是两套独立小组件** → **各自 sitekey + secret**。
- 客户端错误码 `400021`：sitekey 的 region 须与脚本标签域名匹配（china 部件不能只挂 world 脚本域乱绑）。

### 5.3 硬约束（本仓）

1. **Supabase Attack Protection 只支持配置一个 Captcha secret。**  
   china token 无法用 world secret 校验，反之亦然。双区域同时服务 **不能** 只靠「Dashboard 填一个 secret」。
2. **当前 Cloudflare 账号 Dashboard「添加小组件」表单无 Region / 中国 选项**；MCP API token **无** `challenge-widgets.write`，无法 API 创建。  
   → **截至本文 `updated`：未能在本账号落地 `yiveno-login-china`（region=china）。** 疑需 Enterprise Turnstile / 账号能力开通后再建。
3. 即便建出 china 小组件，完整双区域还须 **Worker 双 secret Siteverify**（或关闭 GoTrue 内建 Captcha、改 Admin 发码），否则 `.cn` 与 `.com` 会互斥。

### 5.4 目标架构（未接线 · 待账号能力）

```mermaid
flowchart TD
  U[用户] --> H{访问主机}
  H -->|yiveno.cn / 强制 CN| CN[china 小组件 sitekey<br/>+ 匹配脚本域]
  H -->|yiveno.com / localhost| W[world 小组件 sitekey]
  CN --> T[captchaToken]
  W --> T
  T --> WR[Worker：Siteverify<br/>先试 WORLD_SECRET<br/>再试 CHINA_SECRET]
  WR -->|通过| OTP[再触发发 OTP<br/>须绕过「单 secret GoTrue Captcha」]
  WR -->|失败| X[拒绝发码]
```

**在 china 小组件可用之前的务实策略（现行）：**

- 继续 **单 world 小组件** + Supabase 单 secret（已开）。
- 挑战失败：LoginForm 明确提示改用 Google / Microsoft（海外可达时）或刷新重试。
- 主机名已含 `.cn`，geo 软跳到 `yiveno.cn` 后仍用同一 world 部件（可达性不保证改善，但配置一致）。
- 账号具备 china 能力后：按 §5.4 建 `yiveno-login-china`、补 `PUBLIC_TURNSTILE_SITE_KEY_CHINA`、Worker 双验，再改 Normative。

### 5.5 开通 china 后运维检查清单

- [ ] Dashboard / API 创建 `region: china`，主机名至少含 `yiveno.cn` / `www.yiveno.cn` /（按需）`localhost`
- [ ] 记下 china **sitekey + secret**；secret **不进** `.env.shared.local` 明文仓（进 Worker Secret / 密码器）
- [ ] 客户端按主机名选 sitekey + 正确脚本源
- [ ] **不要**只把 china secret 填进 Supabase 而 `.com` 仍用 world sitekey
- [ ] 落地 Worker 双 Siteverify（或等价），再 MCP：`.cn` 与 `.com` 各抽测发码一次

---

## 6. 相关代码与文档

| 路径                                   | 职责                               |
| -------------------------------------- | ---------------------------------- |
| `website/src/services/turnstile.ts`    | 加载脚本、render、reset            |
| `website/src/components/LoginForm.vue` | 发码/重发门禁、失败文案            |
| `website/src/services/auth.ts`         | `signInWithOtp(..., captchaToken)` |
| `docs/AUTH_GUIDE.md`                   | 运维步骤（Captcha 必开）           |
| `docs/ENVIRONMENT.md`                  | `PUBLIC_TURNSTILE_SITE_KEY`        |

---

## 7. 修订

| 日期       | 说明                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| 2026-10-27 | 首版：生命周期 / 流程图 / 密钥分工；记录 china 区域未落地原因与目标双验架构 |
