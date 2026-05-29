# Google One Tap 登录配置指南

本文档说明如何为 AcuityBookmarks 官网配置 Google One Tap 登录功能。

## 📋 前置条件

- 已有 Google Cloud 项目
- 已配置 Supabase Google OAuth（参考 `SUPABASE_OAUTH_SETUP.md`）
- 可以使用现有的 OAuth 2.0 客户端 ID

---

## 🔧 配置步骤

### 1. 获取 Google OAuth 客户端 ID

#### 方案 A：使用现有的 OAuth 客户端 ID（推荐）

如果你已经为 Supabase OAuth 创建了 Google 客户端 ID，可以直接复用：

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择你的项目
3. 导航到 **API 和服务 > 凭据**
4. 找到现有的 **OAuth 2.0 客户端 ID**
5. 复制客户端 ID（格式：`xxxxx.apps.googleusercontent.com`）

#### 方案 B：创建新的 OAuth 客户端 ID

如果需要单独的客户端 ID：

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择你的项目
3. 导航到 **API 和服务 > 凭据**
4. 点击 **创建凭据 > OAuth 2.0 客户端 ID**
5. 应用类型选择 **Web 应用**
6. 配置授权来源（见下方）

---

### 2. 配置授权的 JavaScript 来源

在 OAuth 客户端 ID 配置中，添加以下 URL：

**生产环境：**

```
https://acuitybookmarks.com
```

**开发环境：**

```
http://localhost:3001
```

**注意：**

- One Tap 只在 HTTPS 网站上工作（本地开发可以用 `localhost`）
- 确保域名与实际访问的域名完全一致

---

### 3. 配置环境变量

#### 3.1 更新根目录 `.env` 文件

```bash
# Google OAuth 配置（用于 One Tap 登录）
NUXT_PUBLIC_GOOGLE_CLIENT_ID="你的客户端ID.apps.googleusercontent.com"
```

#### 3.2 运行环境变量同步脚本

```bash
# 从项目根目录运行
bun run sync-env
```

这会自动将配置同步到 `website/.env` 文件。

---

### 4. 验证配置

#### 4.1 检查环境变量

```bash
# 在 website 目录下
cd website
cat .env | grep GOOGLE_CLIENT_ID
```

应该看到：

```
NUXT_PUBLIC_GOOGLE_CLIENT_ID=你的客户端ID.apps.googleusercontent.com
```

#### 4.2 启动开发服务器

```bash
cd website
bun run dev
```

#### 4.3 测试 One Tap

1. 打开浏览器访问 `http://localhost:3001`
2. 确保你已登录 Google 账号（在浏览器中）
3. 如果配置正确，应该会看到 Google One Tap 弹窗

---

## 🎨 功能特性

### 自动显示逻辑

One Tap 会在以下情况下自动显示：

- ✅ 用户未登录
- ✅ 用户已在浏览器中登录 Google 账号
- ✅ 用户之前授权过该网站（或首次访问）
- ✅ 不在冷却期内（用户关闭后 1 小时内不再显示）

### 智能冷却期

- 用户主动关闭 One Tap 后，1 小时内不再显示
- 冷却期可在组件中配置（默认 3600 秒）
- 使用 `localStorage` 记录用户偏好

### 无缝集成

- 与现有 Supabase Auth 完全兼容
- 登录成功后自动跳转到账户页面
- 支持多标签页同步登录状态

---

## 🔍 调试指南

### 检查浏览器控制台

One Tap 组件会输出详细的日志：

```javascript
[GoogleOneTap] 开始加载 SDK...
[GoogleOneTap] SDK 加载成功
[GoogleOneTap] 开始初始化...
[GoogleOneTap] 初始化成功
[GoogleOneTap] 显示 One Tap 提示...
```

### 常见问题

#### 1. One Tap 不显示

**可能原因：**

- 用户已登录（检查 `user` 状态）
- 在冷却期内（清除 `localStorage` 中的 `google_onetap_dismissed_at`）
- 用户未在浏览器中登录 Google 账号
- 域名未添加到授权来源

**解决方法：**

```javascript
// 在浏览器控制台执行
localStorage.removeItem('google_onetap_dismissed_at')
// 刷新页面
```

#### 2. SDK 加载失败

**可能原因：**

- 网络问题
- 浏览器扩展阻止了 Google 脚本

**解决方法：**

- 检查网络连接
- 禁用广告拦截器
- 检查浏览器控制台的错误信息

#### 3. 登录失败

**可能原因：**

- Google Client ID 配置错误
- Supabase 未启用 Google OAuth
- ID Token 验证失败

**解决方法：**

- 检查环境变量配置
- 确认 Supabase Dashboard 中已启用 Google Provider
- 查看浏览器控制台和 Supabase 日志

---

## 📚 相关文档

- [Google Identity Services 文档](https://developers.google.com/identity/gsi/web/guides/overview)
- [Supabase Google OAuth 文档](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [One Tap 最佳实践](https://developers.google.com/identity/gsi/web/guides/features)

---

## 🎯 组件使用示例

### 基础用法

```vue
<template>
  <GoogleOneTap v-if="!user" />
</template>

<script setup>
const { user } = useAuth()
</script>
```

### 自定义配置

```vue
<template>
  <GoogleOneTap
    v-if="!user"
    :auto-prompt="true"
    :remember-dismissal="true"
    :cooldown-period="7200"
    @success="handleSuccess"
    @error="handleError"
    @dismissed="handleDismissed"
  />
</template>

<script setup>
const { user } = useAuth()

const handleSuccess = userData => {
  console.log('登录成功:', userData.email)
}

const handleError = error => {
  console.error('登录失败:', error.message)
}

const handleDismissed = () => {
  console.log('用户关闭了 One Tap')
}
</script>
```

### 手动触发

```vue
<template>
  <div>
    <GoogleOneTap ref="oneTapRef" :auto-prompt="false" />
    <button @click="showOneTap">显示 One Tap</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const oneTapRef = ref(null)

const showOneTap = () => {
  oneTapRef.value?.prompt()
}
</script>
```

---

## 🔒 安全注意事项

1. **HTTPS 必须**
   - One Tap 只在 HTTPS 网站上工作
   - 本地开发可以使用 `localhost`

2. **域名白名单**
   - 在 Google Console 中严格限制授权域名
   - 防止钓鱼网站滥用

3. **ID Token 验证**
   - Supabase 会自动验证 Google ID Token
   - 不要信任前端传来的任何用户信息

4. **用户隐私**
   - 遵守 Google 的用户数据政策
   - 明确告知用户数据使用方式

---

**最后更新**: 2025-01-XX  
**版本**: 1.0.0
