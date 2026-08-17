const API_BASE = import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com'

/** 与 Worker `/api/website/subscription` 响应对齐。 */
export interface UserSubscription {
  tier: string
  status: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
}

/** 官网快照是否为有效 Pro（含周期结束取消、期内仍 Pro）。 */
export function isActiveProSnapshot(sub: UserSubscription | null | undefined): boolean {
  return sub?.tier === 'pro' && sub.status === 'active'
}

/**
 * 查询当前登录用户订阅（须传 Supabase access token；禁止信任裸 userId）。
 */
export async function getUserSubscription(accessToken: string): Promise<UserSubscription | null> {
  try {
    const res = await fetch(`${API_BASE}/api/website/subscription`, {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    })
    if (!res.ok) return null
    const data = (await res.json()) as UserSubscription
    if (!data || typeof data.tier !== 'string') return null
    return data
  } catch {
    return null
  }
}
