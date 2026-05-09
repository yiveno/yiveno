# 认证状态调试指南

## 问题现象

Popup 页面的头像一直显示为灰色（未登录状态），即使在官网已经登录。

## 可能的原因

1. **localStorage 中没有 session 数据**
2. **Supabase 客户端没有正确读取 localStorage**
3. **`useSupabaseAuth` 初始化失败**
4. **Popup 页面的 `onMounted` 没有正确执行**

## 调试步骤

### 1. 检查 localStorage 中的 session

在 Popup 页面打开 DevTools（右键插件图标 → "检查弹出内容"），在 Console 中运行：

```javascript
// 查看所有 Supabase session keys
Object.keys(localStorage).filter(key => key.startsWith('sb-'))

// 查看 session 内容
const sessionKey = Object.keys(localStorage).find(key => key.endsWith('-auth-token'))
if (sessionKey) {
  console.log('Session key:', sessionKey)
  const sessionData = localStorage.getItem(sessionKey)
  console.log('Session data:', JSON.parse(sessionData))
} else {
  console.log('❌ 没有找到 session key')
}
```

**预期结果**：
- 应该看到一个 `sb-<project-ref>-auth-token` key
- session 数据应该包含 `access_token`、`refresh_token`、`user` 等字段

**如果没有 session**：
- 说明官网登录后，session 没有写入 localStorage
- 或者插件和官网使用的是不同的 localStorage（不应该发生）

### 2. 检查 Supabase 客户端配置

在 Popup 页面的 Console 中运行：

```javascript
// 检查 Supabase 客户端是否正确初始化
import('@/infrastructure/supabase/client').then(({ supabase, isSupabaseConfigured }) => {
  console.log('Supabase configured:', isSupabaseConfigured())
  console.log('Supabase client:', supabase)
  
  // 尝试获取 session
  supabase.auth.getSession().then(({ data, error }) => {
    console.log('Session data:', data)
    console.log('Session error:', error)
  })
})
```

**预期结果**：
- `isSupabaseConfigured()` 应该返回 `true`
- `getSession()` 应该返回 session 数据（如果已登录）

### 3. 检查 `useSupabaseAuth` 状态

在 Popup 页面的 Console 中运行：

```javascript
// 查看 useSupabaseAuth 的状态
// 注意：这需要在 Vue DevTools 中查看，或者在组件内部添加日志

// 临时方案：在 UserMenu.vue 中添加日志
console.log('[UserMenu] isAuthenticated:', isAuthenticated.value)
console.log('[UserMenu] user:', user.value)
console.log('[UserMenu] isPro:', isPro.value)
```

### 4. 检查 Popup 页面的初始化

在 `frontend/src/pages/popup/Popup.vue` 的 `onMounted` 中添加日志：

```typescript
onMounted(async () => {
  console.log('[Popup] onMounted 开始')
  
  // 检查 localStorage
  const sessionKeys = Object.keys(localStorage).filter(key => key.startsWith('sb-'))
  console.log('[Popup] localStorage session keys:', sessionKeys)
  
  // ... 其他初始化代码
})
```

### 5. 检查 `storage` 事件监听

在 `frontend/src/composables/useSupabaseAuth.ts` 的 `onMounted` 中添加日志：

```typescript
onMounted(() => {
  console.log('[useSupabaseAuth] onMounted 开始')
  
  initialize().then(() => {
    console.log('[useSupabaseAuth] initialize 完成')
    setupAuthListener()
  })

  // 监听 storage 事件
  if (typeof window !== 'undefined') {
    console.log('[useSupabaseAuth] 开始监听 storage 事件')
    window.addEventListener('storage', (event) => {
      console.log('[useSupabaseAuth] storage 事件触发:', {
        key: event.key,
        oldValue: event.oldValue?.substring(0, 50),
        newValue: event.newValue?.substring(0, 50)
      })
      
      if (event.key?.startsWith('sb-') && event.key?.endsWith('-auth-token')) {
        logger.info('[useSupabaseAuth] 🔔 检测到 localStorage session 变化，刷新状态...')
        initialize()
      }
    })
  }
})
```

## 常见问题排查

### Q1: localStorage 中有 session，但 Popup 显示未登录

**可能原因**：
1. `useSupabaseAuth` 的 `initialize()` 没有正确执行
2. Supabase 客户端没有正确读取 localStorage
3. `onMounted` 执行时机问题

**解决方法**：
1. 在 `useSupabaseAuth.ts` 的 `initialize()` 中添加详细日志
2. 检查 `supabase.auth.getSession()` 的返回值
3. 确认 `user.value` 和 `session.value` 是否正确赋值

### Q2: 官网登录后，Popup 不自动更新

**原因**：
- `storage` 事件只在**跨标签页**时触发
- Popup 页面打开时，需要主动读取 localStorage

**解决方法**：
- Popup 页面每次打开时，`onMounted` 会重新执行
- `initialize()` 会调用 `supabase.auth.getSession()` 读取 localStorage
- 这应该能正确读取到 session

### Q3: 重新构建后仍然不工作

**可能原因**：
1. 浏览器缓存了旧版本的插件
2. localStorage 中的 session 已过期

**解决方法**：
1. 在 Chrome 扩展管理页面，点击"重新加载"
2. 清除 localStorage 中的所有 `sb-*` keys
3. 在官网重新登录
4. 重新打开 Popup

## 临时解决方案

如果调试后发现问题，可以尝试以下临时方案：

### 方案 1: 强制刷新 session

在 `useSupabaseAuth.ts` 的 `initialize()` 中，添加强制刷新逻辑：

```typescript
const initialize = async () => {
  if (!isSupabaseConfigured()) {
    loading.value = false
    error.value = 'Supabase 未配置'
    logger.warn('[useSupabaseAuth] ⚠️ Supabase 未配置，跳过认证初始化')
    return
  }

  try {
    loading.value = true
    logger.debug('[useSupabaseAuth] 开始初始化，检查 session...')

    // 🔑 强制从 localStorage 读取 session
    const {
      data: { session: currentSession },
      error: sessionError
    } = await supabase.auth.getSession()

    if (sessionError) {
      logger.error('[useSupabaseAuth] 获取 session 失败:', sessionError)
      throw sessionError
    }

    logger.debug('[useSupabaseAuth] Session 获取成功:', {
      hasSession: !!currentSession,
      userId: currentSession?.user?.id,
      email: currentSession?.user?.email
    })

    session.value = currentSession
    user.value = currentSession?.user ?? null

    // 🔒 检查不活跃超时
    if (user.value) {
      await checkInactivity()
    }

    logger.debug('[useSupabaseAuth] 初始化完成，登录状态:', !!user.value)
  } catch (err) {
    const authError = err as AuthError
    error.value = authError.message || '获取 session 失败'
    logger.error('[useSupabaseAuth] 初始化失败:', authError)
    session.value = null
    user.value = null
  } finally {
    loading.value = false
  }
}
```

### 方案 2: 添加手动刷新按钮

在 `UserMenu.vue` 中添加一个"刷新"按钮（仅在开发模式显示）：

```vue
<template>
  <div class="user-menu">
    <!-- 现有代码 -->
    
    <!-- 开发模式：刷新按钮 -->
    <button
      v-if="isDev"
      class="user-menu__refresh"
      @click="handleRefresh"
    >
      🔄
    </button>
  </div>
</template>

<script setup lang="ts">
// ... 现有代码

const isDev = import.meta.env.DEV

async function handleRefresh() {
  console.log('[UserMenu] 手动刷新认证状态')
  const { initialize } = useSupabaseAuth()
  await initialize()
}
</script>
```

## 下一步

1. 按照上述步骤逐一排查
2. 在 Console 中记录每一步的输出
3. 找到问题根源后，再进行修复

如果问题仍然存在，请提供：
1. localStorage 中的 session keys（脱敏后）
2. `supabase.auth.getSession()` 的返回值
3. `useSupabaseAuth` 的状态（`user.value`、`session.value`、`isAuthenticated.value`）
4. Console 中的所有日志
