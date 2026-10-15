/**
 * 扩展已登录时：用本机 access 向 Worker 申请官网独立会话（反向接通）。
 */

import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import { logger } from '@/infrastructure/logging/logger'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

export type MintedWebsiteSession = {
  accessToken: string
  refreshToken: string
  userId: string
  email?: string
  expiresAt?: number
}

/**
 * @returns 官网会话字段；扩展未登录 / Worker 失败 → null
 */
export async function mintWebsiteSessionFromExtensionAccess(): Promise<MintedWebsiteSession | null> {
  const session = await getAuthSession()
  const token = session?.accessToken?.trim()
  if (!token || !session?.userId) {
    logger.warn('Auth', '反向接通：扩展未登录，无法铸官网会话')
    return null
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
    if (!res.ok) {
      logger.warn('Auth', '反向接通 website-session HTTP 失败', { status: res.status })
      return null
    }
    const body = (await res.json()) as {
      success?: unknown
      data?: {
        accessToken?: unknown
        refreshToken?: unknown
        userId?: unknown
        email?: unknown
        expiresAt?: unknown
      }
    }
    const data = body.data
    if (
      body.success !== true ||
      !data ||
      typeof data.accessToken !== 'string' ||
      typeof data.refreshToken !== 'string' ||
      typeof data.userId !== 'string'
    ) {
      logger.warn('Auth', '反向接通 website-session 响应缺字段')
      return null
    }
    if (data.userId.trim() !== session.userId.trim()) {
      logger.warn('Auth', '反向接通 userId 与扩展不一致，拒绝')
      return null
    }
    logger.info('Auth', '反向接通：已取得官网会话', {
      userId: data.userId.trim().slice(0, 8)
    })
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      userId: data.userId.trim(),
      ...(typeof data.email === 'string' && data.email.trim() ? { email: data.email.trim() } : {}),
      ...(typeof data.expiresAt === 'number' ? { expiresAt: data.expiresAt } : {})
    }
  } catch (error) {
    logger.warn('Auth', '反向接通 website-session 请求异常', error)
    return null
  }
}
