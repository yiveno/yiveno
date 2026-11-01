/**
 * 扩展源麦克风授权：优先在当前页 getUserMedia；失败则打开 Chrome 站点设置。
 * Side Panel 常弹不出系统提示，故需「页内再试一次 + 设置兜底」，避免整页授权。
 */

import { logger } from '@/infrastructure/logging/logger'

/**
 * 在当前扩展页请求麦克风（拿到即停轨，只为写入权限）。
 * @returns granted | denied
 */
export async function requestExtensionMicrophoneAccess(): Promise<'granted' | 'denied'> {
  if (!navigator.mediaDevices?.getUserMedia) {
    logger.warn('SidePanel', '麦克风授权：无 mediaDevices.getUserMedia')
    return 'denied'
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    for (const track of stream.getTracks()) {
      track.stop()
    }
    logger.info('SidePanel', '麦克风授权：当前页已授予')
    return 'granted'
  } catch (error) {
    logger.warn('SidePanel', '麦克风授权：当前页被拒或失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return 'denied'
  }
}

/** 打开本扩展在浏览器里的站点详情（含麦克风开关）。 */
export async function openExtensionMicrophoneSiteSettings(): Promise<void> {
  const site = `chrome-extension://${chrome.runtime.id}/`
  const url = `chrome://settings/content/siteDetails?site=${encodeURIComponent(site)}`
  logger.info('ExtensionTab', '打开扩展麦克风站点设置', { url })
  await chrome.tabs.create({ url })
}
