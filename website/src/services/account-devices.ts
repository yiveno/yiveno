/**
 * 官网账户页：设备列表 / 撤销 / 改名（Worker device 端点；Bearer=官网 Supabase access）。
 */

const API_BASE = (import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com').replace(
  /\/$/,
  ''
)

export type AccountDevice = {
  deviceId: string
  name: string
  platform: string
  lastSeenAt: string
  createdAt: string
}

export type ListDevicesResult =
  | { status: 'ok'; devices: AccountDevice[] }
  | { status: 'unauthorized' }
  | { status: 'failed'; error: string }

export type DeviceMutationResult =
  | { status: 'ok' }
  | { status: 'not_found' }
  | { status: 'invalid_name' }
  | { status: 'unauthorized' }
  | { status: 'failed'; error: string }

function authHeaders(accessToken: string): HeadersInit {
  return {
    authorization: `Bearer ${accessToken.trim()}`,
    'content-type': 'application/json'
  }
}

function parseDevice(raw: unknown): AccountDevice | null {
  if (typeof raw !== 'object' || raw === null) return null
  const row = raw as Record<string, unknown>
  if (
    typeof row.deviceId !== 'string' ||
    typeof row.name !== 'string' ||
    typeof row.platform !== 'string' ||
    typeof row.lastSeenAt !== 'string' ||
    typeof row.createdAt !== 'string'
  ) {
    return null
  }
  return {
    deviceId: row.deviceId,
    name: row.name,
    platform: row.platform,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt
  }
}

/** GET /api/auth/devices */
export async function listAccountDevices(accessToken: string): Promise<ListDevicesResult> {
  const token = accessToken.trim()
  if (!token) return { status: 'failed', error: 'missing_token' }
  try {
    const res = await fetch(`${API_BASE}/api/auth/devices`, {
      method: 'GET',
      headers: authHeaders(token)
    })
    if (res.status === 401) return { status: 'unauthorized' }
    const body = (await res.json().catch(() => null)) as {
      success?: unknown
      data?: { devices?: unknown }
      error?: unknown
    } | null
    if (!res.ok) {
      const error =
        typeof body?.error === 'string' && body.error.trim()
          ? body.error.trim()
          : `http_${res.status}`
      return { status: 'failed', error }
    }
    const rawList = body?.data?.devices
    if (body?.success !== true || !Array.isArray(rawList)) {
      return { status: 'failed', error: 'invalid_response' }
    }
    const devices: AccountDevice[] = []
    for (const item of rawList) {
      const parsed = parseDevice(item)
      if (parsed) devices.push(parsed)
    }
    return { status: 'ok', devices }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'devices_list_threw'
    }
  }
}

/** POST /api/auth/device-revoke · body `{ deviceId }` */
export async function revokeAccountDevice(
  accessToken: string,
  deviceId: string
): Promise<DeviceMutationResult> {
  const token = accessToken.trim()
  const id = deviceId.trim()
  if (!token || !id) return { status: 'failed', error: 'missing_input' }
  try {
    const res = await fetch(`${API_BASE}/api/auth/device-revoke`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ deviceId: id })
    })
    if (res.status === 401) return { status: 'unauthorized' }
    if (res.status === 404) return { status: 'not_found' }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: unknown } | null
      const error =
        typeof body?.error === 'string' && body.error.trim()
          ? body.error.trim()
          : `http_${res.status}`
      return { status: 'failed', error }
    }
    return { status: 'ok' }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'device_revoke_threw'
    }
  }
}

/** POST /api/auth/device-rename · body `{ deviceId, name }` */
export async function renameAccountDevice(
  accessToken: string,
  deviceId: string,
  name: string
): Promise<DeviceMutationResult & { device?: AccountDevice }> {
  const token = accessToken.trim()
  const id = deviceId.trim()
  const trimmedName = name.trim()
  if (!token || !id) return { status: 'failed', error: 'missing_input' }
  if (!trimmedName || trimmedName.length > 64) return { status: 'invalid_name' }
  try {
    const res = await fetch(`${API_BASE}/api/auth/device-rename`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ deviceId: id, name: trimmedName })
    })
    if (res.status === 401) return { status: 'unauthorized' }
    if (res.status === 404) return { status: 'not_found' }
    if (res.status === 400) return { status: 'invalid_name' }
    const body = (await res.json().catch(() => null)) as {
      success?: unknown
      data?: { device?: unknown }
      error?: unknown
    } | null
    if (!res.ok) {
      const error =
        typeof body?.error === 'string' && body.error.trim()
          ? body.error.trim()
          : `http_${res.status}`
      return { status: 'failed', error }
    }
    const device = parseDevice(body?.data?.device)
    return device ? { status: 'ok', device } : { status: 'ok' }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'device_rename_threw'
    }
  }
}
