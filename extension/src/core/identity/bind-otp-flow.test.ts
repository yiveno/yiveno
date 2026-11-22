import { describe, expect, it } from 'vitest'

import {
  BIND_OTP_RESEND_COOLDOWN_SEC,
  bindOtpCanSendCode,
  bindOtpConfirmFail,
  bindOtpConfirmOk,
  bindOtpIsBusy,
  bindOtpSendFail,
  bindOtpSendOk,
  bindOtpSetEmail,
  bindOtpStartSend,
  bindOtpStartVerify,
  bindOtpTickCooldown,
  bindOtpVerifyFail,
  bindOtpVerifyOk,
  classifyBindOtpError,
  createBindOtpState
} from './bind-otp-flow'

describe('bind-otp-flow', () => {
  it('正常全程：idle → send → verify → confirm → success', () => {
    let state = createBindOtpState()
    state = bindOtpSetEmail(state, 'a@b.com')
    state = bindOtpStartSend(state)
    expect(state.phase).toBe('code_sending')
    expect(bindOtpIsBusy(state)).toBe(true)
    state = bindOtpSendOk(state)
    expect(state.phase).toBe('code_sent')
    expect(state.resendCooldownSec).toBe(BIND_OTP_RESEND_COOLDOWN_SEC)
    expect(bindOtpIsBusy(state)).toBe(false)
    state = { ...state, code: '12345678' }
    state = bindOtpStartVerify(state)
    state = bindOtpVerifyOk(state, { branch: 'promote', claimToken: 'tok' })
    expect(state.phase).toBe('confirming')
    expect(state.branch).toBe('promote')
    state = bindOtpConfirmOk(state)
    expect(state.phase).toBe('success')
    expect(state.claimToken).toBeNull()
  })

  it('换邮箱即废弃验证码状态', () => {
    let state = bindOtpSendOk(bindOtpSetEmail(createBindOtpState(), 'a@b.com'))
    state = { ...state, code: '11111111', claimToken: 'should-clear', branch: 'claim' }
    state = bindOtpSetEmail(state, 'other@b.com')
    expect(state.phase).toBe('idle')
    expect(state.email).toBe('other@b.com')
    expect(state.code).toBe('')
    expect(state.claimToken).toBeNull()
    expect(state.resendCooldownSec).toBe(0)
    expect(state.branch).toBeNull()
  })

  it('倒计时 tick 递减至 0', () => {
    let state = bindOtpSendOk(bindOtpSetEmail(createBindOtpState(), 'a@b.com'))
    expect(state.resendCooldownSec).toBe(BIND_OTP_RESEND_COOLDOWN_SEC)
    state = bindOtpTickCooldown(state)
    expect(state.resendCooldownSec).toBe(BIND_OTP_RESEND_COOLDOWN_SEC - 1)
    state = { ...state, resendCooldownSec: 1 }
    state = bindOtpTickCooldown(state)
    expect(state.resendCooldownSec).toBe(0)
    expect(bindOtpCanSendCode(state)).toBe(true)
    state = bindOtpTickCooldown(state)
    expect(state.resendCooldownSec).toBe(0)
  })

  it('错误分支：invalid_code 保留剩余次数', () => {
    let state = bindOtpSendOk(bindOtpSetEmail(createBindOtpState(), 'a@b.com'))
    state = bindOtpVerifyFail(state, 'invalid_code', 2)
    expect(state.phase).toBe('error')
    expect(state.errorKind).toBe('invalid_code')
    expect(state.remainingAttempts).toBe(2)
  })

  it('classifyBindOtpError 覆盖主要字面', () => {
    expect(classifyBindOtpError('rate_limited')).toBe('rate_limited')
    expect(classifyBindOtpError('captcha_failed')).toBe('captcha')
    expect(classifyBindOtpError('captcha_required')).toBe('captcha')
    expect(classifyBindOtpError('captcha_not_configured')).toBe('captcha_not_configured')
    expect(classifyBindOtpError('code_not_found')).toBe('code_expired')
    expect(classifyBindOtpError('device_limit_reached')).toBe('device_limit')
    expect(classifyBindOtpError('email_send_failed')).toBe('failed')
  })

  it('captcha_not_configured 精确分类；其它 captcha* 仍归 captcha', () => {
    expect(classifyBindOtpError('captcha_not_configured')).toBe('captcha_not_configured')
    expect(classifyBindOtpError('captcha_required')).toBe('captcha')
    expect(classifyBindOtpError('captcha_failed')).toBe('captcha')
    expect(classifyBindOtpError('captcha_timeout')).toBe('captcha')
  })

  it('发码失败 captcha → captchaRetryNeeded；captcha_not_configured 不触发重试', () => {
    const captcha = bindOtpSendFail(bindOtpStartSend(createBindOtpState()), 'captcha_required')
    expect(captcha.errorKind).toBe('captcha')
    expect(captcha.captchaRetryNeeded).toBe(true)

    const notConfigured = bindOtpSendFail(
      bindOtpStartSend(createBindOtpState()),
      'captcha_not_configured'
    )
    expect(notConfigured.errorKind).toBe('captcha_not_configured')
    expect(notConfigured.captchaRetryNeeded).toBe(false)
  })

  it('confirm 竞态 email_conflict 清码', () => {
    let state = bindOtpVerifyOk(bindOtpSendOk(createBindOtpState()), {
      branch: 'promote',
      claimToken: 'tok'
    })
    state = bindOtpConfirmFail(state, 'email_conflict')
    expect(state.errorKind).toBe('email_conflict')
    expect(state.claimToken).toBeNull()
    expect(state.code).toBe('')
  })

  it('弹窗打开重置：createBindOtpState 丢弃 success / code_sent 残留', () => {
    let state = bindOtpConfirmOk(
      bindOtpVerifyOk(bindOtpSendOk(bindOtpSetEmail(createBindOtpState(), 'a@b.com')), {
        branch: 'promote',
        claimToken: 'tok'
      })
    )
    expect(state.phase).toBe('success')
    state = createBindOtpState()
    expect(state.phase).toBe('idle')
    expect(state.email).toBe('')
    expect(state.branch).toBeNull()
    expect(state.claimToken).toBeNull()
  })
})
