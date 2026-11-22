/**
 * 从 navigator 推导设备名与平台。
 * 与扩展 `extension/src/infrastructure/auth/device-label.ts` 映射规则逐字一致。
 * 无法判断时返回空串（调用方不发该字段，由 Worker 兜底）。
 */

/** 生产取自 navigator；测试可注入（platform 须允许空串，勿绑死 DOM 联合字面）。 */
export type DeviceLabelNav = {
  userAgent: string
  platform: string
  userAgentData?: { platform?: string }
}

/** OS：userAgentData → platform → UA 关键词；Chrome OS → ChromeOS。 */
function resolveOs(nav: DeviceLabelNav): string {
  const uaDataPlatform = nav.userAgentData?.platform?.trim()
  if (uaDataPlatform) {
    if (uaDataPlatform === 'Chrome OS') return 'ChromeOS'
    if (
      uaDataPlatform === 'macOS' ||
      uaDataPlatform === 'Windows' ||
      uaDataPlatform === 'Linux' ||
      uaDataPlatform === 'ChromeOS'
    ) {
      return uaDataPlatform
    }
  }

  const plat = nav.platform?.trim() ?? ''
  if (plat === 'MacIntel' || plat.startsWith('Mac')) return 'macOS'
  if (plat === 'Win32' || plat.startsWith('Win')) return 'Windows'
  if (plat === 'Linux' || plat.startsWith('Linux')) return 'Linux'

  const ua = nav.userAgent ?? ''
  if (ua.includes('Mac OS X') || ua.includes('Macintosh')) return 'macOS'
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('CrOS')) return 'ChromeOS'
  if (ua.includes('Linux')) return 'Linux'
  return ''
}

/**
 * 浏览器：Edg → Brave → Firefox → OPR → Chrome → Safari（无 Chrome）。
 * Edge/Brave UA 含 Chrome，顺序不可乱。
 */
function resolveBrowser(ua: string): string {
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('Brave')) return 'Brave'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('OPR/')) return 'Opera'
  if (ua.includes('Chrome/')) return 'Chrome'
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari'
  return ''
}

/**
 * 从 navigator 推导设备名与平台。无法判断时返回空串（调用方不发该字段）。
 * @param nav 仅测试注入；生产不传，用全局 navigator（无则空串）。
 */
export function getDeviceLabelAndPlatform(nav?: DeviceLabelNav): {
  deviceLabel: string
  platform: string
} {
  const resolved: DeviceLabelNav | null =
    nav ?? (typeof navigator !== 'undefined' ? (navigator as DeviceLabelNav) : null)
  if (!resolved) {
    return { deviceLabel: '', platform: '' }
  }

  const os = resolveOs(resolved)
  const browser = resolveBrowser(resolved.userAgent ?? '')

  let deviceLabel = ''
  if (browser && os) {
    deviceLabel = `${browser} on ${os}`
  } else if (browser) {
    deviceLabel = browser
  } else if (os) {
    deviceLabel = os
  }

  return { deviceLabel, platform: os }
}
