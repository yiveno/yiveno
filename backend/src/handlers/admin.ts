/**
 * 管理员接口处理器
 */

import type { Env } from '../types/env'
import { okJson, errorJson } from '../utils/response'
import { getProviderConfig } from './auth'

/**
 * 从环境变量中提取已设置的键
 *
 * @param env - 环境变量
 * @param keys - 要检查的键列表
 * @returns 已设置的键对象
 */
function pickExisting(env: Env, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  const envRecord = env as unknown as Record<string, unknown>
  for (const k of keys) {
    if (env && envRecord[k] !== undefined)
      out[k] =
        typeof envRecord[k] === 'string' && (envRecord[k] as string).length > 0
          ? '(set)'
          : '(empty)'
  }
  return out
}

/**
 * 列出缺失的环境变量键
 *
 * @param env - 环境变量
 * @param keys - 要检查的键列表
 * @returns 缺失的键列表
 */
function listMissing(env: Env, keys: string[]): string[] {
  const envRecord = env as unknown as Record<string, unknown>
  return keys.filter(k => !env || !envRecord[k])
}

/**
 * 构建环境变量报告
 *
 * @param env - 环境变量
 * @returns 环境变量报告
 */
function buildEnvReport(env: Env) {
  const must = {
    jwt: ['JWT_SECRET'],
    google: ['AUTH_GOOGLE_CLIENT_ID', 'AUTH_GOOGLE_CLIENT_SECRET'],
    microsoft: ['AUTH_MICROSOFT_CLIENT_ID', 'AUTH_MICROSOFT_CLIENT_SECRET']
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
 *
 * @param _request - 请求对象
 * @param env - 环境变量
 * @param origin - 请求来源
 * @returns 环境变量检查响应
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
    return errorJson({ error: msg }, 500, origin)
  }
}
