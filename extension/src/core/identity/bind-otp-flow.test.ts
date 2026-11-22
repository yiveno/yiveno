import { describe, expect, it } from 'vitest'

import {
  BIND_OTP_RESEND_COOLDOWN_SEC,
  bindOtpCanSendCode,
  bindOtpConfirmFail,
  bindOtpConfirmOk,
  bindOtpSendFail,
  bindOtpSendOk,
  bindOtpSetEmail,
  bindOtpStartSend,
  bindOtpStartVerify,
  bindOtpTickCooldown,
  bindOtpVerifyFail,
  bindOtpVerifyOk,
  classifyBindOtpError,
  createBindOtpState,
  shouldResetBindOtpForAccountIdentityChange
} from './bind-otp-flow'

describe('bind-otp-flow', () => {
  it('正常全程：idle → send → verify → confirm → success', () => {
    let state = createBindOtpState()
    state = bindOtpSetEmail(state, 'a@b.com')
    state = bindOtpStartSend(state)
    expect(state.phase).toBe('code_sending')
    state = bindOtpSendOk(state)
    expect(state.phase).toBe('code_sent')
    expect(state.resendCooldownSec).toBe(BIND_OTP_RESEND_COOLDOWN_SEC)
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
    expect(classifyBindOtpError('code_not_found')).toBe('code_expired')
    expect(classifyBindOtpError('device_limit_reached')).toBe('device_limit')
    expect(classifyBindOtpError('email_send_failed')).toBe('failed')
  })

  it('发码失败 captcha → captchaRetryNeeded', () => {
    const state = bindOtpSendFail(bindOtpStartSend(createBindOtpState()), 'captcha_required')
    expect(state.errorKind).toBe('captcha')
    expect(state.captchaRetryNeeded).toBe(true)
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

  describe('shouldResetBindOtpForAccountIdentityChange（BF1）', () => {
    it('promote 成功后换新匿名账号 → 应重置（success 不可挡新表单）', () => {
      const afterPromote = {
        accountId: 'acct-same',
        isAnonymous: false
      }
      const newAnonymous = {
        accountId: 'acct-new-anon',
        isAnonymous: true
      }
      expect(shouldResetBindOtpForAccountIdentityChange(afterPromote, newAnonymous)).toBe(true)

      // 调用方重置后：idle + promoteSuccess=false
      let bind = bindOtpConfirmOk(createBindOtpState())
      expect(bind.phase).toBe('success')
      if (shouldResetBindOtpForAccountIdentityChange(afterPromote, newAnonymous)) {
        bind = createBindOtpState()
      }
      expect(bind.phase).toBe('idle')
      expect(bind.phase === 'success').toBe(false)
    })

    it('同账号轮询刷新 → 不重置（保留 code_sent）', () => {
      const identity = { accountId: 'acct-1', isAnonymous: true }
      expect(shouldResetBindOtpForAccountIdentityChange(identity, identity)).toBe(false)

      let bind = bindOtpSendOk(bindOtpSetEmail(createBindOtpState(), 'a@b.com'))
      expect(bind.phase).toBe('code_sent')
      if (shouldResetBindOtpForAccountIdentityChange(identity, { ...identity })) {
        bind = createBindOtpState()
      }
      expect(bind.phase).toBe('code_sent')
      expect(bind.email).toBe('a@b.com')
    })

    it('退出登录 accountId → null → 应重置', () => {
      expect(
        shouldResetBindOtpForAccountIdentityChange(
          { accountId: 'acct-1', isAnonymous: true },
          { accountId: null, isAnonymous: false }
        )
      ).toBe(true)
    })

    it('promote 同号 isAnonymous 翻转 → 应重置（Settings 可接受）', () => {
      expect(
        shouldResetBindOtpForAccountIdentityChange(
          { accountId: 'acct-1', isAnonymous: true },
          { accountId: 'acct-1', isAnonymous: false }
        )
      ).toBe(true)
    })
  })
})
