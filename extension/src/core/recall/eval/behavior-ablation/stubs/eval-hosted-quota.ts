/** eval 替身：embed 预查门控 fail-open。 */
export async function fetchHostedQuota(): Promise<{
  model: string
  tier: 'free'
  used: number
  limit: number
  remaining: number
  dailyUsed: number
  dailyLimit: number
  dailyRemaining: number
  monthKey: string
}> {
  return {
    model: '@cf/meta/llama',
    tier: 'free',
    used: 0,
    limit: 100,
    remaining: 100,
    dailyUsed: 0,
    dailyLimit: 100,
    dailyRemaining: 100,
    monthKey: '2026-11'
  }
}
