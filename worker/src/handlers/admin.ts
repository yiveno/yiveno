/**
 * 管理员接口处理器
 */

import type { Env } from '../types/env'
import { okJson, errorJson } from '../utils/response'
import { getProviderConfig } from './auth'
import { logError } from '../utils/logger'

/** 仅允许读取 Env 上的字符串配置键，避免 as unknown 遍历 */
type EnvConfigKey =
  | 'JWT_SECRET' // JWT 签名密钥
  | 'AUTH_GOOGLE_CLIENT_ID' // Google OAuth Client ID
  | 'AUTH_GOOGLE_CLIENT_SECRET' // Google OAuth Client Secret
  | 'AUTH_MICROSOFT_CLIENT_ID' // Microsoft OAuth Client ID
  | 'AUTH_MICROSOFT_CLIENT_SECRET' // Microsoft OAuth Client Secret

function readConfigValue(env: Env, key: EnvConfigKey): string | undefined {
  const value = env[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * 从环境变量中提取已设置的键
 */
function pickExisting(env: Env, keys: EnvConfigKey[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of keys) {
    const value = readConfigValue(env, k)
    if (value !== undefined) {
      out[k] = value.length > 0 ? '(set)' : '(empty)'
    }
  }
  return out
}

/**
 * 列出缺失或空字符串的环境变量键
 */
function listMissing(env: Env, keys: EnvConfigKey[]): string[] {
  return keys.filter(k => {
    const value = readConfigValue(env, k)
    return !value
  })
}

/**
 * 构建环境变量报告
 */
function buildEnvReport(env: Env) {
  const must = {
    jwt: ['JWT_SECRET'] as EnvConfigKey[],
    google: ['AUTH_GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_CLIENT_SECRET'] as EnvConfigKey[],
    microsoft: ['AUTH_MICROSOFT_CLIENT_ID', 'AUTH_MICROSOFT_CLIENT_SECRET'] as EnvConfigKey[]
  }
  const missing = {
    jwt: listMissing(env, must.jwt),
    google: listMissing(env, must.google),
    microsoft: listMissing(env, must.microsoft)
  }
  const has = {
    jwt: pickExisting(env, must.jwt),
    google: pickExisting(env, must.google),
    microsoft: pickExisting(env, must.microsoft)
  }
  const optional = {
    allowlist: env.REDIRECT_URI_ALLOWLIST || env.REDIRECT_ALLOWLIST || undefined
  }
  return { has, missing, optional }
}

/**
 * 处理管理员环境变量检查请求
 */
export function handleAdminEnvCheck(_request: Request, env: Env, origin: string | null): Response {
  try {
    const report = buildEnvReport(env)
    const gCfg = getProviderConfig('google', env)
    const msCfg = getProviderConfig('microsoft', env)
    const providers = {
      google: Boolean(gCfg),
      googleHasSecret: Boolean(gCfg && gCfg.clientSecret),
      microsoft: Boolean(msCfg),
      microsoftHasSecret: Boolean(msCfg && msCfg.clientSecret)
    }
    return okJson({ success: true, report, providers }, origin)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logError(err, { path: '/api/admin/env/check', detail: msg })
    return errorJson({ error: 'admin_env_check_failed' }, 500, origin)
  }
}
