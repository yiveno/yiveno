import { afterEach, describe, expect, jest, test } from 'bun:test'

import type { Env } from '../../types/env'
import {
  isDirectMailConfigured,
  percentEncode,
  sendDirectMail,
  signDirectMailRpcParams
} from './aliyun-directmail'

describe('percentEncode', () => {
  test('空格与星号按阿里云规则', () => {
    expect(percentEncode('a b')).toBe('a%20b')
    expect(percentEncode('a*b')).toBe('a%2Ab')
    expect(percentEncode('~')).toBe('~')
  })
})

describe('signDirectMailRpcParams', () => {
  test('同输入可复现签名', async () => {
    const params = {
      AccessKeyId: 'testid',
      Action: 'SingleSendMail',
      Format: 'JSON',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: 'nonce-1',
      SignatureVersion: '1.0',
      Timestamp: '2026-01-01T00:00:00Z',
      Version: '2015-11-23'
    }
    const a = await signDirectMailRpcParams('testsecret', params)
    const b = await signDirectMailRpcParams('testsecret', params)
    expect(a).toBe(b)
    expect(a.length).toBeGreaterThan(10)
  })
})

describe('isDirectMailConfigured / sendDirectMail', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('缺 AK → not_configured', async () => {
    expect(isDirectMailConfigured({} as Env)).toBe(false)
    const result = await sendDirectMail({} as Env, {
      to: 'a@b.co',
      subject: 's',
      text: 't',
      html: '<p>h</p>'
    })
    expect(result).toEqual({ ok: false, reason: 'not_configured', detail: 'missing_access_key' })
  })

  test('API 成功 → ok + requestId', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ RequestId: 'req_1', EnvId: 'env_1' }), { status: 200 })
      )
    const env = {
      ALIYUN_DM_ACCESS_KEY_ID: 'ak',
      ALIYUN_DM_ACCESS_KEY_SECRET: 'sk'
    } as Env

    const result = await sendDirectMail(env, {
      to: 'buyer@example.com',
      subject: "You're on Yiveno Pro",
      text: 'Thanks',
      html: '<p>Thanks</p>',
      accountName: 'hello@yiveno.com'
    })

    expect(result).toEqual({ ok: true, requestId: 'req_1', envId: 'env_1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('dm.aliyuncs.com')
    expect(init?.method).toBe('POST')
    const body = String(init?.body)
    expect(body).toContain('Action=SingleSendMail')
    expect(body).toContain(encodeURIComponent('hello@yiveno.com'))
    expect(body).toContain('Signature=')
  })

  test('API 4xx → api_error', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ Code: 'InvalidMailAddress.NotFound', Message: 'missing' }), {
        status: 404
      })
    )
    const env = {
      ALIYUN_DM_ACCESS_KEY_ID: 'ak',
      ALIYUN_DM_ACCESS_KEY_SECRET: 'sk'
    } as Env
    const result = await sendDirectMail(env, {
      to: 'a@b.co',
      subject: 's',
      text: 't',
      html: '<p>h</p>'
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('api_error')
      expect(result.detail).toContain('InvalidMailAddress.NotFound')
    }
  })
})
