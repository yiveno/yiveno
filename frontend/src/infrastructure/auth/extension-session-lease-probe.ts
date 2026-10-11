/**
 * 向 Worker 探测本扩展 access token 是否仍为账号活跃租约。
 * 被挤掉时不依赖 Supabase refresh（避免 rate limit 挡住退登）。
 */

import { logger } from '@/infrastructure/logging/logger'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

export type ExtensionSessionLeaseProbeResult =
  | { status: 'active' } // 仍是活跃租约，或服务端未知（勿踢）
  | { status: 'displaced' } // KV 租约已是另一 session
  | { status: 'uncertain'; reason: string } // 网络/5xx：保留登录，回退 refresh

type LeaseProbeResponse = {
  success?: boolean
  data?: {
    active?: boolean
    reason?: string
  }
  error?: string
}

/**
 * Bearer = 扩展 access token。
 */
export async function probeExtensionSessionLease(
  accessToken: string
): Promise<ExtensionSessionLeaseProbeResult> {
  const token = accessToken.trim()
  if (!token) {
    return { status: 'uncertain', reason: 'missing_access_token' }
  }

  let response: Response
  try {
    response = await fetch(`${getApiBaseUrl()}/api/auth/extension-session-lease`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json'
      }
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'lease_probe_network_error'
    logger.warn('Auth', 'lease 探测网络失败', { reason })
    return { status: 'uncertain', reason }
  }

  if (response.status === 401) {
    // access 已被 Auth 拒绝：视作会话作废（含被挤掉后 JWT 校验失败）
    return { status: 'displaced' }
  }

  if (!response.ok) {
    const reason = `lease_probe_http_${response.status}`
    logger.warn('Auth', 'lease 探测非成功', { status: response.status })
    return { status: 'uncertain', reason }
  }

  const payload = (await response.json().catch(() => ({}))) as LeaseProbeResponse
  if (payload.data?.active === false && payload.data.reason === 'displaced') {
    return { status: 'displaced' }
  }
  return { status: 'active' }
}
