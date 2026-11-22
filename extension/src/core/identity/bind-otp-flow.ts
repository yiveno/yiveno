/**
 * 绑定 OTP 共用状态机（Settings / Side Panel 经 BindOtpModal）。
 * UI 状态由弹窗自持；不进 chrome.storage。绝不持有/打印 claimToken 内容到日志。
 */

/** 与服务端发码冷却对齐（秒）。 */
export const BIND_OTP_RESEND_COOLDOWN_SEC = 60

export type BindOtpPhase =
  | 'idle' // 待发码
  | 'code_sending' // 发码中
  | 'code_sent' // 已发码，待输入
  | 'verifying' // 验码中
  | 'confirming' // promote/claim 进行中
  | 'success' // 成功
  | 'error' // 可恢复错误（保留邮箱等）

/** 诚实归因错误种类（UI 再映射到 i18n）。 */
export type BindOtpErrorKind =
  | 'rate_limited'
  | 'invalid_code'
  | 'too_many_attempts'
  | 'code_expired'
  | 'captcha' // token 缺失/无效，用户完成验证可解
  | 'captcha_not_configured' // 服务端缺 Turnstile secret，用户操作无解
  | 'email_conflict'
  | 'claim_user_not_found'
  | 'device_limit'
  | 'failed'

export type BindOtpState = {
  phase: BindOtpPhase
  email: string
  code: string
  remainingAttempts: number | null
  resendCooldownSec: number
  errorKind: BindOtpErrorKind | null
  captchaRetryNeeded: boolean
  branch: 'promote' | 'claim' | null
  /** 验码成功后短时持有；成功/换邮箱/失败清掉；禁止 log */
  claimToken: string | null
}

export function createBindOtpState(): BindOtpState {
  return {
    phase: 'idle',
    email: '',
    code: '',
    remainingAttempts: null,
    resendCooldownSec: 0,
    errorKind: null,
    captchaRetryNeeded: false,
    branch: null,
    claimToken: null
  }
}

/** API / 客户端 error 字面 → 归因种类。 */
export function classifyBindOtpError(apiError: string | undefined | null): BindOtpErrorKind {
  const error = (apiError ?? '').trim()
  if (error === 'rate_limited') return 'rate_limited'
  if (error === 'invalid_code') return 'invalid_code'
  if (error === 'too_many_attempts') return 'too_many_attempts'
  if (error === 'code_expired' || error === 'code_not_found') return 'code_expired'
  // 先精确匹配服务端配置缺失，再兜底其它 captcha*
  if (error === 'captcha_not_configured') return 'captcha_not_configured'
  if (error.startsWith('captcha')) return 'captcha'
  if (error === 'email_conflict') return 'email_conflict'
  if (error === 'claim_user_not_found') return 'claim_user_not_found'
  if (error === 'device_limit_reached') return 'device_limit'
  return 'failed'
}

/** 工作相位（弹窗 loading / 禁 Esc）。 */
export function bindOtpIsBusy(state: BindOtpState): boolean {
  return (
    state.phase === 'code_sending' || state.phase === 'verifying' || state.phase === 'confirming'
  )
}

/** 换邮箱：废弃当前验证码状态，回 idle。 */
export function bindOtpSetEmail(state: BindOtpState, email: string): BindOtpState {
  const next = email
  if (next.trim() === state.email.trim()) {
    return { ...state, email: next }
  }
  return {
    ...createBindOtpState(),
    email: next
  }
}

export function bindOtpSetCode(state: BindOtpState, code: string): BindOtpState {
  return { ...state, code, errorKind: state.phase === 'error' ? null : state.errorKind }
}

export function bindOtpStartSend(state: BindOtpState): BindOtpState {
  return {
    ...state,
    phase: 'code_sending',
    errorKind: null,
    captchaRetryNeeded: false,
    claimToken: null,
    branch: null,
    code: ''
  }
}

export function bindOtpSendOk(state: BindOtpState): BindOtpState {
  return {
    ...state,
    phase: 'code_sent',
    errorKind: null,
    captchaRetryNeeded: false,
    resendCooldownSec: BIND_OTP_RESEND_COOLDOWN_SEC,
    remainingAttempts: null,
    claimToken: null
  }
}

export function bindOtpSendFail(state: BindOtpState, apiError: string | undefined): BindOtpState {
  const errorKind = classifyBindOtpError(apiError)
  return {
    ...state,
    phase: 'error',
    errorKind,
    captchaRetryNeeded: errorKind === 'captcha',
    claimToken: null
  }
}

export function bindOtpStartVerify(state: BindOtpState): BindOtpState {
  return {
    ...state,
    phase: 'verifying',
    errorKind: null
  }
}

export function bindOtpVerifyOk(
  state: BindOtpState,
  input: { branch: 'promote' | 'claim'; claimToken: string }
): BindOtpState {
  return {
    ...state,
    phase: 'confirming',
    errorKind: null,
    branch: input.branch,
    claimToken: input.claimToken,
    remainingAttempts: null
  }
}

export function bindOtpVerifyFail(
  state: BindOtpState,
  apiError: string | undefined,
  remainingAttempts?: number
): BindOtpState {
  const errorKind = classifyBindOtpError(apiError)
  return {
    ...state,
    phase: 'error',
    errorKind,
    claimToken: null,
    branch: null,
    remainingAttempts:
      typeof remainingAttempts === 'number' ? remainingAttempts : state.remainingAttempts,
    // 码作废类：回到可重发；仍保留邮箱
    ...(errorKind === 'too_many_attempts' || errorKind === 'code_expired'
      ? { code: '', resendCooldownSec: 0 }
      : {})
  }
}

export function bindOtpConfirmFail(
  state: BindOtpState,
  apiError: string | undefined
): BindOtpState {
  const errorKind = classifyBindOtpError(apiError)
  return {
    ...state,
    phase: 'error',
    errorKind,
    claimToken: null,
    branch: null,
    // 竞态 / 目标不存在：需重新验码
    ...(errorKind === 'email_conflict' || errorKind === 'claim_user_not_found'
      ? { code: '', resendCooldownSec: 0 }
      : {})
  }
}

export function bindOtpConfirmOk(state: BindOtpState): BindOtpState {
  return {
    ...state,
    phase: 'success',
    errorKind: null,
    claimToken: null,
    code: '',
    captchaRetryNeeded: false
  }
}

/** 倒计时 tick（由 UI setInterval 驱动）。 */
export function bindOtpTickCooldown(state: BindOtpState): BindOtpState {
  if (state.resendCooldownSec <= 0) {
    return state
  }
  return { ...state, resendCooldownSec: state.resendCooldownSec - 1 }
}

/** 发码按钮是否可用（非发送中，且冷却结束或尚未进入已发码）。 */
export function bindOtpCanSendCode(state: BindOtpState): boolean {
  if (!state.email.trim()) return false
  if (
    state.phase === 'code_sending' ||
    state.phase === 'verifying' ||
    state.phase === 'confirming'
  ) {
    return false
  }
  if (state.phase === 'success') return false
  if (state.resendCooldownSec > 0) return false
  return true
}

/** 验码按钮是否可用。 */
export function bindOtpCanVerify(state: BindOtpState): boolean {
  if (!state.email.trim() || !state.code.trim()) return false
  if (
    state.phase === 'code_sending' ||
    state.phase === 'verifying' ||
    state.phase === 'confirming'
  ) {
    return false
  }
  if (state.phase === 'success') return false
  return state.phase === 'code_sent' || state.phase === 'error'
}
