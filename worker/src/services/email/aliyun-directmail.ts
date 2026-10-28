/**
 * 阿里云邮件推送 DirectMail · SingleSendMail（RPC 签名）。
 * 用于 Worker 产品外发（Pro 欢迎信）；与 Supabase OTP 的 SMTP 通道分立。
 */

import type { Env } from '../../types/env'

const DEFAULT_ENDPOINT = 'https://dm.aliyuncs.com/'
const API_VERSION = '2015-11-23'
const DEFAULT_REGION = 'cn-hangzhou'

export type DirectMailSendInput = {
  to: string
  subject: string
  text: string
  html: string
  /** 发信地址；默认 hello@yiveno.com 或 env.ALIYUN_DM_ACCOUNT_NAME */
  accountName?: string
  fromAlias?: string
  replyAddress?: string
}

export type DirectMailSendResult =
  | { ok: true; requestId: string; envId: string | null }
  | { ok: false; reason: 'not_configured' | 'api_error'; detail: string }

function readTrim(env: Env, key: keyof Env): string | null {
  const raw = env[key]
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

/** 是否已配置 DirectMail AccessKey（未配则跳过发信，不 5xx） */
export function isDirectMailConfigured(env: Env): boolean {
  return Boolean(
    readTrim(env, 'ALIYUN_DM_ACCESS_KEY_ID') && readTrim(env, 'ALIYUN_DM_ACCESS_KEY_SECRET')
  )
}

/** 阿里云 OpenAPI 百分号编码（RPC 签名专用） */
export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~')
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  for (const b of view) binary += String.fromCharCode(b)
  return btoa(binary)
}

async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return bytesToBase64(sig)
}

/**
 * 构造 RPC 签名（HMAC-SHA1）。仅导出供单测。
 */
export async function signDirectMailRpcParams(
  accessKeySecret: string,
  params: Record<string, string>
): Promise<string> {
  const sortedKeys = Object.keys(params).sort()
  const canonical = sortedKeys
    .map(key => `${percentEncode(key)}=${percentEncode(params[key]!)}`)
    .join('&')
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonical)}`
  return hmacSha1Base64(`${accessKeySecret}&`, stringToSign)
}

function utcTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * 发送单封邮件（HtmlBody + TextBody）。
 * 缺 AK 返回 not_configured；API 失败返回 api_error（不抛）。
 */
export async function sendDirectMail(
  env: Env,
  input: DirectMailSendInput
): Promise<DirectMailSendResult> {
  const accessKeyId = readTrim(env, 'ALIYUN_DM_ACCESS_KEY_ID')
  const accessKeySecret = readTrim(env, 'ALIYUN_DM_ACCESS_KEY_SECRET')
  if (!accessKeyId || !accessKeySecret) {
    return { ok: false, reason: 'not_configured', detail: 'missing_access_key' }
  }

  const accountName =
    input.accountName?.trim() || readTrim(env, 'ALIYUN_DM_ACCOUNT_NAME') || 'hello@yiveno.com'
  const fromAlias = input.fromAlias?.trim() || readTrim(env, 'ALIYUN_DM_FROM_ALIAS') || 'Yiveno'
  const replyAddress =
    input.replyAddress?.trim() || readTrim(env, 'ALIYUN_DM_REPLY_ADDRESS') || 'support@yiveno.com'
  const regionId = readTrim(env, 'ALIYUN_DM_REGION_ID') || DEFAULT_REGION
  const endpoint = (readTrim(env, 'ALIYUN_DM_ENDPOINT') || DEFAULT_ENDPOINT).replace(/\/?$/, '/')

  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: 'SingleSendMail',
    AddressType: '1',
    AccountName: accountName,
    ToAddress: input.to,
    Subject: input.subject,
    HtmlBody: input.html,
    TextBody: input.text,
    FromAlias: fromAlias.slice(0, 15),
    ReplyToAddress: 'true',
    ReplyAddress: replyAddress,
    Format: 'JSON',
    RegionId: regionId,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: '1.0',
    Timestamp: utcTimestamp(),
    Version: API_VERSION,
    ClickTrace: '0'
  }

  try {
    const signature = await signDirectMailRpcParams(accessKeySecret, params)
    params.Signature = signature

    const body = new URLSearchParams(params)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body
    })
    const rawText = await response.text()
    let json: Record<string, unknown> | null = null
    try {
      json = JSON.parse(rawText) as Record<string, unknown>
    } catch {
      json = null
    }

    if (!response.ok) {
      const code = typeof json?.Code === 'string' ? json.Code : `http_${response.status}`
      const message = typeof json?.Message === 'string' ? json.Message : rawText.slice(0, 200)
      return { ok: false, reason: 'api_error', detail: `${code}: ${message}` }
    }

    const requestId =
      (typeof json?.RequestId === 'string' && json.RequestId) ||
      (typeof json?.requestId === 'string' && json.requestId) ||
      'unknown'
    const envId =
      (typeof json?.EnvId === 'string' && json.EnvId) ||
      (typeof json?.envId === 'string' && json.envId) ||
      null
    return { ok: true, requestId, envId }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: 'api_error', detail }
  }
}
