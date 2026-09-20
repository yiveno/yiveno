# 认证系统使用指南

> **最后更新：** 2026-09-17  
> **状态：** Yiveno 使用**自定义 JWT + OAuth**（Google / Microsoft）；**不使用 Supabase Auth** 前端 composable。

## 🎯 概述

Yiveno 认证流程：

1. **扩展/官网** → `/api/auth/start?provider=google|microsoft` → OAuth Provider 授权页
2. **OAuth Provider** → 回调 `/api/auth/callback` → Worker 签发 **自定义 JWT**
3. **前端** 存储 JWT → 后续请求携带 `Authorization: Bearer <token>`

**不使用** Supabase 前端 SDK `useSupabaseAuth`。

---

## 🔐 认证架构

### Backend（Worker）

| 端点                      | 职责                                           |
| ------------------------- | ---------------------------------------------- |
| `GET /api/auth/start`     | 生成 OAuth 授权 URL，重定向到 Google/Microsoft |
| `GET /api/auth/callback`  | 接收 OAuth code，换 token，签发 JWT            |
| `GET /api/auth/providers` | 返回可用的 OAuth 提供商列表                    |

**JWT Claims：**

```typescript
interface YivenoJWT {
  sub: string // `${provider}:${oauthSubject}`（唯一用户 ID）
  email: string
  tier: 'free' | 'pro'
  features: Record<string, boolean>
  exp: number // 7 天过期
}
```

### Frontend

| 模块                | 路径                                              | 职责                  |
| ------------------- | ------------------------------------------------- | --------------------- |
| **Extension OAuth** | `infrastructure/auth/extension-oauth.ts`          | 扩展内启动 OAuth 流程 |
| **Session Service** | `infrastructure/identity/auth-session-service.ts` | JWT 存储与读取        |
| **Identity Core**   | `core/identity/auth-session.ts`                   | Session 类型定义      |
| **Profile**         | `core/identity/auth-user-profile.ts`              | 用户 Profile 类型     |

---

## 🚀 开发调试

### 查看认证状态

```typescript
import { useAuthSession } from '@/infrastructure/identity/auth-session-service'

const session = useAuthSession()
console.log('User:', session.profile.value)
console.log('Tier:', session.tier.value)
console.log('Is Pro:', session.isPro.value)
```

### 清除认证数据

```javascript
// 在 DevTools Console 中执行
chrome.storage.local.remove(['yiveno_auth_token', 'yiveno_auth_profile'], () => {
  console.log('已清除认证数据')
  location.reload()
})
```

### 查看 JWT

```javascript
chrome.storage.local.get('yiveno_auth_token', items => {
  const token = items['yiveno_auth_token']
  if (token) {
    // 解码 JWT payload
    const payload = JSON.parse(atob(token.split('.')[1]))
    console.log('JWT payload:', payload)
  }
})
```

---

## 🔧 环境变量

```bash
# .env.shared.local
AUTH_GOOGLE_CLIENT_ID=
AUTH_GOOGLE_CLIENT_SECRET=
AUTH_MICROSOFT_CLIENT_ID=
AUTH_MICROSOFT_CLIENT_SECRET=
JWT_SECRET=                     # JWT 签名密钥（生产必须随机）
REDIRECT_URI_ALLOWLIST=        # 允许的回调域名（逗号分隔）
```

**本地开发回调：**

- 扩展：`https://<extension-id>.chromiumapp.org/`
- 官网：`http://localhost:3001`

---

## 📚 相关文档

- [Chrome Extension OAuth](https://developer.chrome.com/docs/extensions/reference/identity/)
- [JWT 标准](https://jwt.io/)
- [Yiveno 术语表](../product/Yiveno-术语表.md)（术语唯一权威）
- [Yiveno 产品文档 v4.0](../product/Yiveno-产品文档-v4.0.md)（产品/架构行为契约）
- [环境变量](../ENVIRONMENT.md)

## ❓ 常见问题

### Q: 为什么不使用 Supabase Auth 前端 SDK？

A: Yiveno 使用**自定义 JWT + OAuth**（Worker 签发），不依赖 Supabase 前端 SDK。Supabase 仅用于服务端数据存储。

### Q: 用户首次登录需要注册吗？

A: 不需要。首次 OAuth 登录时会自动创建账号。

### Q: JWT 过期了怎么办？

A: JWT 有效期 7 天。过期后需要重新登录。

### Q: 中国用户如何登录？

A: 需要使用 VPN 访问 Google/Microsoft。未来可以考虑添加其他登录方式。
