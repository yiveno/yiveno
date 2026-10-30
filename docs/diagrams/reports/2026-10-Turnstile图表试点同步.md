---
created: 2026-10-30T23:42:00+08:00
updated: 2026-10-30T23:42:00+08:00
author: agent:cursor
scope: Mermaid 可视化体系试点 · Turnstile Email OTP 五图对照 website 实现
status: done
upstream:
  - docs/diagrams/registry.json
  - docs/engineering/Turnstile-Email-OTP-防刷生命周期.md
  - website/src/services/turnstile.ts
  - website/src/components/LoginForm.vue
  - website/src/services/auth.ts
downstream:
  - bun run docs:check-diagrams
  - docs/engineering/Yiveno-Mermaid图表规范.md
---

# Turnstile 图表试点同步报告（2026-10-30）

## 范围

| id                                   | kind      | status      |
| ------------------------------------ | --------- | ----------- |
| `turnstile.captcha-token-lifecycle`  | sequence  | implemented |
| `turnstile.captcha-token-state`      | state     | implemented |
| `turnstile.email-otp-e2e`            | flowchart | implemented |
| `turnstile.secrets-split`            | flowchart | implemented |
| `turnstile.china-dual-region-target` | flowchart | planned     |

## 审阅依据

- `website/src/services/turnstile.ts`：`PUBLIC_TURNSTILE_SITE_KEY`、脚本加载、`appearance: interaction-only`、callback / expired / error → reset
- `LoginForm.vue`：发码/重发前必有 `captchaToken`；`signInWithEmailOtp` 后 `resetTurnstile()`；验码路径不带 Captcha；未配置 sitekey / 加载失败引导 OAuth
- `auth.ts`：OTP 携带 captchaToken（对照调用链）
- `docs/AUTH_GUIDE.md` / `ENVIRONMENT.md`：密钥分工与 env 名

**未**调用外部 LLM API；未改业务代码。

## 差异结论

| 项                                         | 结论                                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 发码 → Siteverify → reset → 验码无 Captcha | 与 sequence / state / e2e **一致**                                                                              |
| sitekey 进 bundle、secret 仅 Supabase      | 与 secrets-split **一致**                                                                                       |
| china 双区域                               | 仍为 **planned**；图与正文 §5.4 一致，**未**画成现行路径                                                        |
| 重发同样消耗 token 并 reset                | sequence 以首发为主路径；重发与首发同构，**未单独加节点**（避免噪 Diff；行为已被 e2e「持有 token → 提交」覆盖） |

**本轮未改 Mermaid 边/节点**（仅加 registry 锚点与文档索引）。结构上图已对齐实现。

## 校验

- `bun run docs:check-diagrams`（预期通过；见交付时命令输出）
- 渲染：宿主 MD 内 Mermaid，Cursor/GitHub 预览即可

## 不确定性

- Supabase GoTrue Siteverify 与 Rate Limit 的**服务端内部顺序**以 Cloudflare/Supabase 黑盒为准；图中分层为产品/工程可见边界，非 GoTrue 源码级证明。
- china 小组件账号能力是否仍不可用：以宿主 MD §5.3 为准，本轮未再调 Cloudflare MCP 复核。

## Git

- Diff 应为：锚点注释 + registry/规范/脚本 + 本报告；**无**大段重绘。
- 回滚：还原宿主 MD / `registry.json` 即可恢复旧图。
