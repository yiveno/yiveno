/**
 * @acuity-bookmarks/auth-core
 *
 * 认证核心逻辑共享包
 * 提供平台无关的认证服务、验证器和错误处理
 */

// 导出主服务类
export { AuthService } from './auth-service'

// 导出验证器
export {
  validateEmail,
  validatePassword,
  isEmailValid,
  isPasswordValid,
  getPasswordErrorMessage
} from './validators'

// 导出错误处理
export { SUPABASE_ERROR_CODES, extractErrorCode, getErrorMessage } from './error-codes'

// 导出类型
export type {
  OAuthProvider,
  AuthResponse,
  SignInCredentials,
  SignUpInfo,
  PasswordResetInfo,
  PasswordUpdateInfo,
  OAuthConfig,
  ValidationResult
} from './types'
