/**
 * 官网顶栏 Pro 环用的会话缓存。
 * 避免 AuthNav 每次挂载都打强制对账的 /api/website/subscription。
 */

const NAV_IS_PRO_KEY = 'yiveno_nav_is_pro' as const

/** 读取缓存；无记录返回 null。 */
export function readNavIsProCache(): boolean | null {
  try {
    const v = sessionStorage.getItem(NAV_IS_PRO_KEY)
    if (v === '1') return true
    if (v === '0') return false
  } catch {
    // ignore
  }
  return null
}

/** 账户 / 定价页对账成功后写入，供顶栏复用。 */
export function writeNavIsProCache(isPro: boolean): void {
  try {
    sessionStorage.setItem(NAV_IS_PRO_KEY, isPro ? '1' : '0')
  } catch {
    // ignore
  }
}

/** 退出登录时清掉，避免假 Pro 环。 */
export function clearNavIsProCache(): void {
  try {
    sessionStorage.removeItem(NAV_IS_PRO_KEY)
  } catch {
    // ignore
  }
}
