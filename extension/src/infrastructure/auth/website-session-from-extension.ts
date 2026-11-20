/**
 * 扩展已登录时：用 device Bearer（或迁移窗旧 access）向 Worker 申请官网独立会话（反向接通）。
 */

import { getWorkerApiAccessToken } from '@/infrastructure/identity/worker-api-access-token'
import { getDeviceSession } from '@/infrastructure/identity/device-session-service'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import { logger } from '@/infrastructure/logging/logger'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

export type WebsiteSessionFromExtension = {
  accessToken: string
  refreshToken: string
  userId: string
  email?: string
  expiresAt?: number
}

export type WebsiteSessionFromExtensionResult =
  | { status: 'ok'; session: WebsiteSessionFromExtension }
  | { status: 'not_signed_in' }
  | { status: 'email_required' }
  | { status: 'failed'; error: string }

/**
 * POST /api/auth/website-session（device Bearer 优先）。
 * 匿名无 email → `email_required`（官网 L1 引导先转正，不得静默失败）。
 */
export async function requestWebsiteSessionFromExtension(): Promise<WebsiteSessionFromExtensionResult> {
  const token = await getWorkerApiAccessToken()
  if (!token) {
    logger.warn('Auth', '反向接通：扩展未登录，无法申请官网会话')
    return { status: 'not_signed_in' }
  }

  const device = await getDeviceSession()
  const legacy = await getAuthSession()
  const expectedUserId = device?.userId?.trim() || legacy?.userId?.trim() || ''
  if (!expectedUserId) {
    logger.warn('Auth', '反向接通：无本地 userId')
    return { status: 'not_signed_in' }
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/website-session`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: '{}'
    })
    const body = (await res.json().catch(() => null)) as {
      success?: unknown
      data?: {
        accessToken?: unknown
        refreshToken?: unknown
        userId?: unknown
        email?: unknown
        expiresAt?: unknown
      }
      error?: unknown
    } | null

    if (res.status === 400 && body?.error === 'email_required') {
      logger.info('Auth', '反向接通：匿名需先转正（email_required）')
      return { status: 'email_required' }
    }

    if (!res.ok) {
      const error =
        typeof body?.error === 'string' && body.error.trim()
          ? body.error.trim()
          : `http_${res.status}`
      logger.warn('Auth', '反向接通 website-session HTTP 失败', {
        status: res.status,
        error,
        tokenSuffix: token.slice(-4)
      })
      return { status: 'failed', error }
    }

    const data = body?.data
    if (
      body?.success !== true ||
      !data ||
      typeof data.accessToken !== 'string' ||
      typeof data.refreshToken !== 'string' ||
      typeof data.userId !== 'string'
    ) {
      logger.warn('Auth', '反向接通 website-session 响应缺字段')
      return { status: 'failed', error: 'invalid_response' }
    }
    if (data.userId.trim() !== expectedUserId) {
      logger.warn('Auth', '反向接通 userId 与扩展不一致，拒绝')
      return { status: 'failed', error: 'user_id_mismatch' }
    }
    logger.info('Auth', '反向接通：已取得官网会话', {
      userId: data.userId.trim().slice(0, 8)
    })
    return {
      status: 'ok',
      session: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        userId: data.userId.trim(),
        ...(typeof data.email === 'string' && data.email.trim()
          ? { email: data.email.trim() }
          : {}),
        ...(typeof data.expiresAt === 'number' ? { expiresAt: data.expiresAt } : {})
      }
    }
  } catch (error) {
    logger.warn('Auth', '反向接通 website-session 请求异常', error)
    return { status: 'failed', error: 'network_error' }
  }
}
