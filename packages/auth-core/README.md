# @ottersage/auth-core

认证核心逻辑共享包，提供平台无关的 Supabase 认证服务。

## 📦 功能

- ✅ 邮箱密码注册/登录
- ✅ OAuth 登录（Google）
- ✅ 密码重置
- ✅ 表单验证
- ✅ 错误处理和友好提示
- ✅ TypeScript 类型支持

## 🎯 设计理念

**共享逻辑层，UI 独立实现**

- **核心逻辑**：封装在 `AuthService` 类中，与平台无关
- **验证器**：可在前后端复用的表单验证逻辑
- **错误处理**：统一的错误码映射和友好提示
- **UI 实现**：各平台独立实现（Extension、Website）

## 📚 使用方法

### 1. 基础用法

```typescript
import { AuthService } from '@ottersage/auth-core'
import { createClient } from '@supabase/supabase-js'

// 初始化 Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 创建认证服务实例
const authService = new AuthService(supabase)

// 注册
await authService.signUp({
  email: 'user@example.com',
  password: 'secure-password'
})

// 登录
await authService.signIn({
  email: 'user@example.com',
  password: 'secure-password'
})

// 登出
await authService.signOut()
```

### 2. 表单验证

```typescript
import { validateEmail, validatePassword } from '@ottersage/auth-core'

// 验证邮箱
const emailResult = validateEmail('user@example.com')
if (!emailResult.valid) {
  console.error(emailResult.message)
}

// 验证密码
const passwordResult = validatePassword('mypassword123')
if (!passwordResult.valid) {
  console.error(passwordResult.message) // "密码必须包含字母和数字"
}
```

### 3. 错误处理

```typescript
import { getErrorMessage, extractErrorCode } from '@ottersage/auth-core'

try {
  await authService.signIn(credentials)
} catch (error) {
  const errorCode = extractErrorCode(error)
  const friendlyMessage = getErrorMessage(errorCode, '登录失败')
  console.error(friendlyMessage)
}
```

## 📖 API 文档

### AuthService

#### `signUp(info: SignUpInfo): Promise<AuthResponse>`

邮箱密码注册

#### `signIn(credentials: SignInCredentials): Promise<AuthResponse>`

邮箱密码登录

#### `getOAuthUrl(provider: OAuthProvider, config: OAuthConfig): Promise<{ url: string }>`

获取 OAuth 授权 URL

#### `setOAuthSession(accessToken: string, refreshToken: string): Promise<AuthResponse>`

使用 OAuth tokens 设置会话

#### `signOut(): Promise<void>`

登出

#### `resetPassword(info: PasswordResetInfo): Promise<void>`

发送密码重置邮件

#### `updatePassword(info: PasswordUpdateInfo): Promise<void>`

更新密码

### 验证器

- `validateEmail(email: string): ValidationResult`
- `validatePassword(password: string): ValidationResult`
- `isEmailValid(email: string): boolean`
- `isPasswordValid(password: string): boolean`

## 🔧 开发

```bash
# 安装依赖
bun install

# 类型检查
bun run typecheck
```

## 📝 许可

MIT
