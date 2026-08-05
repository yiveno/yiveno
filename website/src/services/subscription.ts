const API_BASE = import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com'

/** 与 Worker `/api/website/subscription` 响应对齐。 */
export interface UserSubscription {
  tier: string
  status: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  try {
    const res = await fetch(`${API_BASE}/api/website/subscription?userId=${userId}`)
    if (!res.ok) return null
    const data = (await res.json()) as UserSubscription
    if (!data || typeof data.tier !== 'string') return null
    return data
  } catch {
    return null
  }
}
