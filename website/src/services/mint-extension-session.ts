/**
 * 向 Worker 申请扩展专用 Supabase session（独立 refresh 族；扩展单活跃）。
 */

const API_BASE = (import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com').replace(
  /\/$/,
  ''
)

export type MintedExtensionSession = {
  accessToken: string
  refreshToken: string
  userId: string
  email?: string
  expiresAt?: number
  displaced?: boolean
  /** 扩展登录后挂进卸载 URL；缺省则卸载页仍开、但不销远程会话 */
  uninstallRevokeToken?: string
}

export type MintExtensionSessionResult =
  | { status: 'ok'; session: MintedExtensionSession }
  | { status: 'needs_displace_confirm'; existingMintedAt: string | null }
  | { status: 'failed' }

type MintApiData = {
  accessToken?: unknown
  refreshToken?: unknown
  userId?: unknown
  email?: unknown
  expiresAt?: unknown
  displaced?: unknown
  uninstallRevokeToken?: unknown
}

/**
 * 用官网当前 access token 换取扩展独立会话。
 * `extensionId`：扩展包 id（元数据）；互斥看服务端扩展租约。`confirmDisplace`：确认挤掉其它已登录扩展（不触及官网会话）。
 */
export async function mintExtensionSession(
  websiteAccessToken: string,
  options: { confirmDisplace?: boolean; extensionId?: string } = {}
): Promise<MintExtensionSessionResult> {
  const token = websiteAccessToken.trim()
  if (!token) {
    return { status: 'failed' }
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/extension-session`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        confirmDisplace: options.confirmDisplace === true,
        ...(options.extensionId?.trim() ? { extensionId: options.extensionId.trim() } : {})
      })
    })

    if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as {
        error?: unknown
        data?: { existingMintedAt?: unknown }
      } | null
      if (body?.error === 'needs_displace_confirm') {
        const at = body.data?.existingMintedAt
        return {
          status: 'needs_displace_confirm',
          existingMintedAt: typeof at === 'string' ? at : null
        }
      }
      return { status: 'failed' }
    }

    if (!res.ok) {
      console.warn('[MintExtensionSession] HTTP', res.status)
      return { status: 'failed' }
    }
    const body = (await res.json()) as { success?: unknown; data?: MintApiData }
    const data = body.data
    if (
      body.success !== true ||
      !data ||
      typeof data.accessToken !== 'string' ||
      typeof data.refreshToken !== 'string' ||
      typeof data.userId !== 'string'
    ) {
      console.warn('[MintExtensionSession] 响应缺字段')
      return { status: 'failed' }
    }
    return {
      status: 'ok',
      session: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        userId: data.userId,
        ...(typeof data.email === 'string' && data.email.trim()
          ? { email: data.email.trim() }
          : {}),
        ...(typeof data.expiresAt === 'number' ? { expiresAt: data.expiresAt } : {}),
        ...(data.displaced === true ? { displaced: true } : {}),
        ...(typeof data.uninstallRevokeToken === 'string' && data.uninstallRevokeToken.trim()
          ? { uninstallRevokeToken: data.uninstallRevokeToken.trim() }
          : {})
      }
    }
  } catch (error) {
    console.warn('[MintExtensionSession] fetch failed', error)
    return { status: 'failed' }
  }
}
