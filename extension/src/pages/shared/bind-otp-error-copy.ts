/**
 * 绑定 OTP 错误种类 → i18n key（BindOtpModal 共用）。
 */

import type { BindOtpErrorKind } from '@/core/identity/bind-otp-flow'
import type { MessageKey } from '@/infrastructure/i18n/message-keys'
import { t } from '@/infrastructure/i18n/t'

/** 全量 kind → key（单测核对无缺失）。 */
export const BIND_OTP_ERROR_KEYS: Record<BindOtpErrorKind, MessageKey> = {
  rate_limited: 'settings_bind_error_rate_limited',
  invalid_code: 'settings_bind_error_invalid_code',
  too_many_attempts: 'settings_bind_error_too_many_attempts',
  code_expired: 'settings_bind_error_code_expired',
  captcha: 'settings_bind_error_captcha',
  captcha_not_configured: 'settings_bind_error_captcha_not_configured',
  email_conflict: 'settings_bind_error_email_conflict',
  claim_user_not_found: 'settings_bind_error_claim_user_not_found',
  device_limit: 'settings_bind_error_device_limit',
  failed: 'settings_bind_error_failed'
}

/** 将状态机 errorKind 译成用户文案；invalid_code 可带剩余次数。 */
export function tBindOtpError(kind: BindOtpErrorKind, remainingAttempts?: number | null): string {
  const key = BIND_OTP_ERROR_KEYS[kind]
  if (kind === 'invalid_code' && typeof remainingAttempts === 'number') {
    return t(key, [String(remainingAttempts)])
  }
  return t(key)
}
