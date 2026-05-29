# Backend 中间件

本目录包含 Backend 的所有中间件实现。

## 中间件列表

### 1. JWT 认证中间件 (`jwt.ts`)

使用 Hono 的 JWT 中间件验证 JWT token。

**使用方法：**

```typescript
import { jwtAuth } from './middleware/jwt'

// 在路由中使用
app.use('/api/admin/*', jwtAuth())
app.use('/api/gumroad/*', jwtAuth())
```

**JWT Payload 类型：**

```typescript
interface JWTPayload {
  sub: string // 用户 ID（格式：provider:id）
  email: string // 用户邮箱
  tier: string // 订阅等级（free/pro/premium）
  features: Record<string, unknown> // 功能权限
  iat?: number // 签发时间
  exp?: number // 过期时间
}
```

**在路由中获取 JWT Payload：**

```typescript
adminRouter.get('/env/check', async c => {
  // JWT payload 由 jwtAuth() 中间件自动注入到 c.get('jwtPayload')
  const jwtPayload = c.get('jwtPayload') as JWTPayload | undefined

  // 使用 JWT payload
  if (jwtPayload) {
    console.log('User:', jwtPayload.sub, jwtPayload.email)
  }

  // ...
})
```

### 2. Bearer Auth 中间件 (`bearer-auth.ts`)

使用 Hono 的 Bearer Auth 中间件验证 Bearer token。

**使用方法：**

```typescript
import { bearerAuthMiddleware } from './middleware/bearer-auth'

// 在路由中使用
app.use('/api/webhook/*', bearerAuthMiddleware('your-secret-token'))
```

**适用场景：**

- Webhook 回调验证
- API Key 验证
- 简单的 Bearer token 验证

### 3. Secure Headers 中间件 (`secure-headers.ts`)

使用 Hono 的 Secure Headers 中间件添加安全响应头。

**使用方法：**

```typescript
import { secureHeadersMiddleware } from './middleware/secure-headers'

// 在应用中使用（全局）
app.use('*', secureHeadersMiddleware())
```

**添加的安全响应头：**

- `X-Content-Type-Options: nosniff` - 防止 MIME 类型嗅探
- `X-Frame-Options: DENY` - 防止点击劫持
- `X-XSS-Protection: 1; mode=block` - 启用浏览器 XSS 过滤器
- `Referrer-Policy: strict-origin-when-cross-origin` - 控制 Referer 头信息
- `Content-Security-Policy` - 内容安全策略

### 4. CORS 中间件 (`cors.ts`)

自定义 CORS 中间件，控制跨域访问。

**使用方法：**

```typescript
import { cors } from 'hono/cors'
import { ALLOWED_ORIGINS } from './middleware/cors'

app.use(
  '*',
  cors({
    origin: origin => {
      // Chrome Extension 的 origin 格式：chrome-extension://extension-id
      const isChromeExtension = origin.startsWith('chrome-extension://')

      // 检查是否为允许的来源
      if (ALLOWED_ORIGINS.includes(origin) || isChromeExtension) {
        return origin
      }

      // 不允许的来源：返回 null（浏览器会阻止请求）
      return null
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['content-type', 'authorization'],
    credentials: true,
    maxAge: 86400 // 24 小时
  })
)
```

## 中间件执行顺序

在 `app.ts` 中，中间件按以下顺序执行：

1. **Secure Headers** - 添加安全响应头
2. **CORS** - 处理跨域请求
3. **Logger** - 记录请求日志
4. **Custom Logger** - 自定义日志记录
5. **JWT Auth** - JWT 认证（仅特定路由）
6. **Bearer Auth** - Bearer token 认证（仅特定路由）

## 环境变量

### JWT 认证

- `JWT_SECRET` - JWT 密钥（优先）
- `SECRET` - 备用密钥

### Bearer Auth

- `API_KEY` - API Key（用于 Bearer Auth）
- `WEBHOOK_SECRET` - Webhook 密钥（用于 Bearer Auth）

## 最佳实践

### 1. 路由级别认证

```typescript
// ✅ 推荐：在路由级别使用中间件
app.use('/api/admin/*', jwtAuth())
app.route('/api/admin', adminRouter)

// ❌ 不推荐：在全局使用认证中间件
app.use('*', jwtAuth()) // 会导致所有路由都需要认证
```

### 2. 权限检查

```typescript
// 在路由处理器中检查用户权限
adminRouter.get('/env/check', async c => {
  const jwtPayload = c.get('jwtPayload') as JWTPayload | undefined

  // 检查用户权限
  if (jwtPayload && jwtPayload.tier !== 'admin') {
    return c.json({ error: 'Forbidden: Admin access required' }, 403)
  }

  // ...
})
```

### 3. 错误处理

```typescript
// JWT 中间件会自动处理以下错误：
// - 401 Unauthorized: token 缺失或无效
// - 403 Forbidden: token 过期

// 在路由处理器中捕获其他错误
try {
  // ...
} catch (err) {
  return c.json({ error: 'Internal Server Error' }, 500)
}
```

## 参考资料

- [Hono JWT Middleware](https://hono.dev/docs/middleware/builtin/jwt)
- [Hono Bearer Auth Middleware](https://hono.dev/docs/middleware/builtin/bearer-auth)
- [Hono Secure Headers Middleware](https://hono.dev/docs/middleware/builtin/secure-headers)
- [Hono CORS Middleware](https://hono.dev/docs/middleware/builtin/cors)
