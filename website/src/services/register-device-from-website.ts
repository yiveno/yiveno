/**
 * 官网用当前 Supabase access 调 Worker `device-register`（mode=website_connect）。
 * 取代旧 `mint-extension-session`（extension-session 已 410）。
 */

const API_BASE = (import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com').replace(
  /\/$/,
  ''
)

/** 与 Worker `DeviceRegisterSuccess` 对齐。 */
export type RegisteredDeviceFromWebsite = {
  deviceToken: string
  deviceId: string
  userId: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  isAnonymous: boolean
}

export type RegisterDeviceFromWebsiteResult =
  | { status: 'ok'; data: RegisteredDeviceFromWebsite }
  | { status: 'unauthorized'; error: string }
  | { status: 'failed'; error: string; httpStatus?: number }

type RegisterApiData = {
  deviceToken?: unknown
  deviceId?: unknown
  userId?: unknown
  email?: unknown
  displayName?: unknown
  avatarUrl?: unknown
  isAnonymous?: unknown
}

function readNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * POST /api/auth/device-register · website_connect。
 * Bearer = 官网 access；成功返回 register data。
 */
export async function registerDeviceFromWebsite(
  websiteAccessToken: string,
  options: { extensionId?: string } = {}
): Promise<RegisterDeviceFromWebsiteResult> {
  const token = websiteAccessToken.trim()
  if (!token) {
    return { status: 'failed', error: 'missing_website_access_token' }
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/device-register`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        mode: 'website_connect',
        ...(options.extensionId?.trim() ? { extensionId: options.extensionId.trim() } : {})
      })
    })

    const body = (await res.json().catch(() => null)) as {
      success?: unknown
      data?: RegisterApiData
      error?: unknown
    } | null

    if (res.status === 401) {
      const error =
        typeof body?.error === 'string' && body.error.trim() ? body.error.trim() : 'unauthorized'
      console.warn('[RegisterDevice] 401 官网会话无效', { error })
      return { status: 'unauthorized', error }
    }

    if (!res.ok) {
      const error =
        typeof body?.error === 'string' && body.error.trim()
          ? body.error.trim()
          : `http_${res.status}`
      console.warn('[RegisterDevice] HTTP 失败', { status: res.status, error })
      return { status: 'failed', error, httpStatus: res.status }
    }

    const data = body?.data
    if (
      body?.success !== true ||
      !data ||
      typeof data.deviceToken !== 'string' ||
      data.deviceToken.length < 32 ||
      typeof data.deviceId !== 'string' ||
      typeof data.userId !== 'string' ||
      typeof data.isAnonymous !== 'boolean'
    ) {
      console.warn('[RegisterDevice] 响应缺字段')
      return { status: 'failed', error: 'invalid_device_register_response', httpStatus: res.status }
    }

    return {
      status: 'ok',
      data: {
        deviceToken: data.deviceToken,
        deviceId: data.deviceId,
        userId: data.userId,
        email: readNullableString(data.email),
        displayName: readNullableString(data.displayName),
        avatarUrl: readNullableString(data.avatarUrl),
        isAnonymous: data.isAnonymous
      }
    }
  } catch (error) {
    console.warn('[RegisterDevice] fetch failed', error)
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'device_register_threw'
    }
  }
}

/**
 * handoff 失败时尽力撤刚发的 device token（防幽灵设备行）。
 * 用 register 响应里的 deviceToken 调 device-revoke-self；失败不抛。
 */
export async function rollbackIssuedDeviceToken(deviceToken: string | undefined): Promise<boolean> {
  const trimmed = typeof deviceToken === 'string' ? deviceToken.trim() : ''
  if (!trimmed) {
    return false
  }
  try {
    const res = await fetch(`${API_BASE}/api/auth/device-revoke-self`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${trimmed}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({})
    })
    if (!res.ok) {
      console.warn('[RegisterDevice] 回滚 device token HTTP 非成功', { status: res.status })
      return false
    }
    console.warn('[RegisterDevice] 已回滚未 handoff 的 device token')
    return true
  } catch (error) {
    console.warn('[RegisterDevice] 回滚 device token 失败', error)
    return false
  }
}
