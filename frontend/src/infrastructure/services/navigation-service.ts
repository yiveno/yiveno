/**
 * 导航服务
 *
 * 职责：
 * - 管理扩展内页面的导航
 * - 处理侧边栏的打开和关闭
 * - 管理 Chrome 通知的显示和清除
 *
 * 功能：
 * - 打开扩展内页面
 * - 打开侧边栏
 * - 显示系统通知
 * - 清除通知
 */

import { logger } from '@/infrastructure/logging/logger'

/**
 * 获取扩展内资源的完整URL
 *
 * @param path - 资源路径（相对于扩展根目录）
 * @returns 完整的扩展资源URL
 */
function getExtensionUrl(path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path
  return chrome.runtime.getURL?.(normalized) ?? normalized
}

/**
 * 在新标签页中打开扩展内页面
 *
 * @param path - 页面路径
 * @throws 当标签页创建失败时抛出错误
 */
async function openExtensionUrl(path: string): Promise<void> {
  const url = getExtensionUrl(path)
  try {
    await chrome.tabs.create?.({ url, active: true })
  } catch (error) {
    logger.warn('NavigationService', `tabs.create 调用失败: ${url}`, error)
    throw error
  }
}

/**
 * 打开侧边栏
 *
 * 使用 Chrome 116+ 的原生 sidePanel API
 *
 * @throws 当打开失败时抛出错误
 */
async function openSidePanel(): Promise<void> {
  if (!chrome.sidePanel?.open || !chrome.sidePanel?.setOptions) {
    const error = new Error('当前浏览器不支持侧边栏功能，请升级到 Chrome 116 或更高版本')
    logger.error('NavigationService', error.message)
    throw error
  }

  // 获取当前活动标签页
  const [currentTab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  })

  if (!currentTab?.windowId) {
    const error = new Error('无法获取当前窗口信息，请确保至少有一个浏览器窗口处于打开状态')
    logger.error('NavigationService', error.message)
    throw error
  }

  logger.debug(
    'NavigationService',
    `尝试打开侧边栏，窗口ID: ${currentTab.windowId}, 标签ID: ${currentTab.id}`
  )

  try {
    // 设置侧边栏选项
    await chrome.sidePanel.setOptions({
      tabId: currentTab.id,
      path: 'side-panel.html',
      enabled: true
    })

    // 设置侧边栏行为（不在点击扩展图标时自动打开）
    if (chrome.sidePanel.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({
        openPanelOnActionClick: false
      })
    }

    // 打开侧边栏
    await chrome.sidePanel.open({ windowId: currentTab.windowId })
    logger.info('NavigationService', '侧边栏打开成功')
  } catch (error) {
    logger.error('NavigationService', '打开侧边栏失败', error)
    throw error
  }
}

/**
 * 显示 Chrome 系统通知
 *
 * @param options - 通知选项
 * @param options.title - 通知标题
 * @param options.message - 通知内容
 * @param options.iconUrl - 可选的图标URL
 * @returns 通知ID，用于后续清除通知
 */
async function showChromeNotification(options: {
  title: string
  message: string
  iconUrl?: string
}): Promise<string> {
  try {
    // 通过消息发送到 Background Script 创建系统通知
    // 因为 chrome.notifications API 只在 Background Script 中可用
    const response = await chrome.runtime.sendMessage({
      type: 'NOTIFICATION',
      data: {
        title: options.title,
        message: options.message,
        iconUrl: options.iconUrl
      }
    })
    return response?.notificationId || ''
  } catch (error) {
    logger.warn('NavigationService', '创建通知失败', error)
    return ''
  }
}

/**
 * 清除指定的 Chrome 系统通知
 *
 * @param id - 通知ID
 */
async function clearChromeNotification(id: string): Promise<void> {
  if (!id) return

  try {
    // 通过消息发送到 Background Script 清除系统通知
    // 因为 chrome.notifications API 只在 Background Script 中可用
    await chrome.runtime.sendMessage({
      type: 'NOTIFICATION_CLEAR',
      data: { notificationId: id }
    })
  } catch (error) {
    logger.warn('NavigationService', '清除通知失败', { id, error })
  }
}

/**
 * 导航服务对象
 *
 * 提供扩展内导航和通知功能的统一接口
 */
export const navigationService = {
  openExtensionUrl,
  openSidePanel,
  showChromeNotification,
  clearChromeNotification
}
