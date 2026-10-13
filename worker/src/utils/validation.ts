/**
 * 校验工具函数
 *
 * 负责 redirect_uri 等安全相关的校验
 */

import type { Env } from '../types/env'
import { error as logErrorMessage, toLogError } from './logger'

/** 默认允许的重定向域后缀，用于 Chrome 扩展 WebAuthFlow。 */
const DEFAULT_ALLOWED_REDIRECT_HOST_SUFFIXES = ['.chromiumapp.org']

/**
 * 解析环境变量中的 allowlist
 *
 * @param env - 环境变量
 * @returns allowlist 数组
 */
export function parseAllowlist(env: Env): string[] {
  const raw = env && (env.REDIRECT_URI_ALLOWLIST || env.REDIRECT_ALLOWLIST || '')
  if (!raw) return []
  try {
    if (raw.trim().startsWith('[')) {
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? arr.map(String) : []
    }
  } catch (e) {
    logErrorMessage('parseAllowlist failed', { detail: toLogError(e) })
  }
  return String(raw)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

/**
 * 检查是否为 HTTPS 的本地地址
 *
 * @param u - URL 对象
 * @returns 是否为 HTTPS 本地地址
 */
function isHttpsLikeLocal(u: URL): boolean {
  return u.protocol === 'https:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
}

/**
 * 检查 HTTPS 主机是否在许可列表中
 */
function isAllowedHttpsHost(u: URL, env: Env): boolean {
  const host = u.hostname.toLowerCase()
  if (DEFAULT_ALLOWED_REDIRECT_HOST_SUFFIXES.some(suf => host.endsWith(suf))) return true
  const allow = parseAllowlist(env)
  if (!allow.length) return false
  const href = u.toString()
  const origin = `${u.protocol}//${u.host}`
  return allow.some(item => href.startsWith(item) || origin === item || host === item)
}

/**
 * 校验 redirect_uri 是否合法
 *
 * @param redirectUri - 重定向 URI
 * @param env - 环境变量
 * @returns 校验结果
 */
export function isAllowedRedirectUri(
  redirectUri: string,
  env: Env
): { ok: boolean; error?: string } {
  try {
    const u = new URL(redirectUri)
    const scheme = u.protocol
    if (scheme !== 'https:' && scheme !== 'chrome-extension:' && !isHttpsLikeLocal(u)) {
      return { ok: false, error: 'unsupported scheme' }
    }
    if (scheme === 'https:') {
      if (!isAllowedHttpsHost(u, env)) {
        return { ok: false, error: 'redirect not in allowlist' }
      }
    }
    if (scheme === 'javascript:' || scheme === 'data:')
      return { ok: false, error: 'dangerous scheme' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'invalid redirect_uri' }
  }
}
