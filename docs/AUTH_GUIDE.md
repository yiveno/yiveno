# 认证系统使用指南

## 🎯 概述

AcuityBookmarks 使用 **OAuth 登录**（Google、Microsoft），不支持邮箱密码登录。

## 🚀 快速开始

### 用户登录

```typescript
import { useSupabaseAuth } from '@/composables'

const { signInWithOAuth, isAuthenticated, user } = useSupabaseAuth()

// Google 登录
await signInWithOAuth('google')

// Microsoft 登录
await signInWithOAuth('microsoft')
```

### 检查登录状态

```typescript
const { isAuthenticated, user } = useSupabaseAuth()

if (isAuthenticated.value) {
  console.log('用户已登录:', user.value.email)
}
```

### 登出

```typescript
const { signOut } = useSupabaseAuth()

await signOut()
```

## 📋 API 参考

### `useSupabaseAuth()`

返回认证相关的状态和方法。

#### 状态

- `user: ComputedRef<User | null>` - 当前用户信息
- `session: ComputedRef<Session | null>` - 当前会话
- `loading: ComputedRef<boolean>` - 加载状态
- `error: ComputedRef<string | null>` - 错误信息
- `isAuthenticated: ComputedRef<boolean>` - 是否已登录

#### 方法

- `signInWithOAuth(provider: 'google' | 'microsoft'): Promise<{ success: boolean }>` - OAuth 登录
- `signOut(): Promise<void>` - 登出
- `initialize(): Promise<void>` - 初始化（自动调用）
- `unsubscribe(): void` - 取消订阅（组件卸载时调用）

## 🔧 配置

### Supabase Dashboard

1. **启用 OAuth Providers**
   - Authentication → Providers → Google (Enabled)
   - Authentication → Providers → Microsoft (Enabled)

2. **配置 Redirect URLs**
   - 添加: `https://<extension-id>.chromiumapp.org/`

3. **禁用邮箱注册**
   - Authentication → Providers → Email → Disable sign ups

### 环境变量

```bash
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 💡 最佳实践

### 1. 错误处理

```typescript
try {
  await signInWithOAuth('google')
} catch (error) {
  if (error.message.includes('取消')) {
    // 用户取消授权，不显示错误
  } else {
    // 显示错误信息
    console.error('登录失败:', error)
  }
}
```

### 2. 加载状态

```vue
<template>
  <Button :loading="loading" :disabled="loading" @click="handleLogin">
    登录
  </Button>
</template>

<script setup>
const { signInWithOAuth, loading } = useSupabaseAuth()

const handleLogin = async () => {
  await signInWithOAuth('google')
}
</script>
```

### 3. 路由守卫

```typescript
// router/index.ts
router.beforeEach((to, from, next) => {
  const { isAuthenticated } = useSupabaseAuth()

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next('/auth')
  } else {
    next()
  }
})
```

## 🔍 调试

### 查看认证状态

```typescript
const { user, session } = useSupabaseAuth()

console.log('User:', user.value)
console.log('Session:', session.value)
```

### 查看本地存储

```javascript
// 在 DevTools Console 中执行
chrome.storage.local.get(null, items => {
  console.log('Storage:', items)
})
```

### 清除认证数据

```javascript
// 清除 Supabase session
chrome.storage.local.get(null, items => {
  const supabaseKeys = Object.keys(items).filter(
    key => key.startsWith('sb-') || key.includes('supabase')
  )
  chrome.storage.local.remove(supabaseKeys, () => {
    console.log('已清除认证数据')
    location.reload()
  })
})
```

## 🎨 UI 示例

### 登录按钮

```vue
<template>
  <div class="login-buttons">
    <Button @click="signInWithOAuth('google')" :loading="loading">
      <GoogleIcon />
      使用 Google 登录
    </Button>

    <Button @click="signInWithOAuth('microsoft')" :loading="loading">
      <MicrosoftIcon />
      使用 Microsoft 登录
    </Button>
  </div>
</template>
```

### 用户信息显示

```vue
<template>
  <div v-if="isAuthenticated" class="user-info">
    <Avatar :src="user.user_metadata?.picture" />
    <span>{{ user.user_metadata?.full_name || user.email }}</span>
    <Button @click="signOut">登出</Button>
  </div>
</template>
```

## 📚 相关文档

- [Supabase Auth 文档](https://supabase.com/docs/guides/auth)
- [Chrome Extension OAuth](https://developer.chrome.com/docs/extensions/reference/identity/)
- [AcuityBookmarks 产品文档 v3.0（唯一正文）](../product/AcuityBookmarks-产品文档-v3.0.md)

## ❓ 常见问题

### Q: 为什么不支持邮箱密码登录？

A: OAuth 登录提供更好的安全性和用户体验：

- 不需要存储密码
- 一键登录，无需记密码
- 减少开发和维护成本

### Q: 用户首次登录需要注册吗？

A: 不需要。首次 OAuth 登录时会自动创建账号。

### Q: 如何处理账号合并？

A: 如果用户使用不同的 OAuth 提供商但邮箱相同，Supabase 会自动关联到同一账号。

### Q: 中国用户如何登录？

A: 需要使用 VPN 访问 Google。未来可以考虑添加其他登录方式（如微信、支付宝）。

---

**最后更新**: 2026-04-05
