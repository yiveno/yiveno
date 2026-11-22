import { afterEach, describe, expect, jest, test } from 'bun:test'

import type { Env } from '../../types/env'
import { buildBindOtpMail, sendBindOtpMail } from './bind-otp-mail'

describe('buildBindOtpMail', () => {
  test('中文模板含验证码与有效期 / 非本人', () => {
    const mail = buildBindOtpMail('12345678', 'zh')
    expect(mail.subject).toContain('验证码')
    expect(mail.text).toContain('12345678')
    expect(mail.text).toContain('10 分钟')
    expect(mail.text).toContain('非本人操作请忽略')
    expect(mail.html).toContain('12345678')
    expect(mail.html).toContain('10 分钟')
  })

  test('英文模板含验证码与有效期 / ignore', () => {
    const mail = buildBindOtpMail('87654321', 'en')
    expect(mail.subject.toLowerCase()).toContain('verification')
    expect(mail.text).toContain('87654321')
    expect(mail.text).toContain('10 minutes')
    expect(mail.text.toLowerCase()).toContain("if you didn't request this")
    expect(mail.html).toContain('87654321')
  })
})

describe('sendBindOtpMail', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('发信 mock：调 DirectMail 且含验证码', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ RequestId: 'r1' }), { status: 200 }))
    const env = {
      ALIYUN_DM_ACCESS_KEY_ID: 'ak',
      ALIYUN_DM_ACCESS_KEY_SECRET: 'sk'
    } as Env

    const result = await sendBindOtpMail(env, 'a@b.co', '11223344', 'en')
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = String(fetchMock.mock.calls[0]![1]?.body ?? '')
    expect(body).toContain(encodeURIComponent('11223344').replace(/%20/g, '%20'))
    // Subject / HtmlBody 经 percentEncode；至少确认请求发往 DirectMail
    expect(String(fetchMock.mock.calls[0]![0])).toContain('dm.aliyuncs.com')
  })
})
