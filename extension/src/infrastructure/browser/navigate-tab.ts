/**
 * 在浏览器标签中打开 URL（供 Side Panel 结果卡等）。
 * 默认复用当前活动标签，避免预览堆出一堆新 Tab。
 */

import { tryParseNavigableUrl } from '@/core/recall/memory-open-href'
import { logger } from '@/infrastructure/logging/logger'

/** 导航处置：当前活动标签 | 前台新标签。 */
export type TabNavigateDisposition =
  | 'currentTab' // 复用当前活动标签
  | 'newForegroundTab' // 新建并激活标签

/**
 * 打开可导航 URL。
 * - currentTab：更新 lastFocusedWindow 的活动标签；无可用标签则新建
 * - newForegroundTab：始终 chrome.tabs.create
 * @returns 打开或更新后的标签（供通知点击聚焦等）
 */
export async function navigateTabToUrl(
  rawUrl: string,
  disposition: TabNavigateDisposition = 'currentTab'
): Promise<chrome.tabs.Tab> {
  const url = tryParseNavigableUrl(rawUrl)
  if (!url) {
    logger.warn('Nav', '拒绝不可导航 URL', { preview: rawUrl.slice(0, 80) })
    throw new Error('NAVIGATE_URL_INVALID')
  }

  if (disposition === 'newForegroundTab') {
    const tab = await chrome.tabs.create({ url })
    logger.info('Nav', '已新开前台标签', { preview: url.slice(0, 80), tabId: tab.id ?? null })
    return tab
  }

  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (typeof active?.id === 'number') {
    const tab = await chrome.tabs.update(active.id, { url, active: true })
    if (typeof active.windowId === 'number') {
      await chrome.windows.update(active.windowId, { focused: true })
    }
    logger.info('Nav', '已在当前活动标签打开', {
      tabId: active.id,
      preview: url.slice(0, 80)
    })
    return tab ?? active
  }

  const tab = await chrome.tabs.create({ url })
  logger.info('Nav', '无活动标签，已新建', { preview: url.slice(0, 80), tabId: tab.id ?? null })
  return tab
}
