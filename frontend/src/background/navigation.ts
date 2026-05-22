/**
 * 页面导航工具
 *
 * 职责：
 * - 封装扩展内页面的打开逻辑
 * - 提供统一的导航接口
 * - 避免在多个模块中重复字符串拼接
 * - 统一错误处理
 *
 * 功能：
 * - 打开书签整理页面
 * - 打开设置页面
 * - 打开侧边栏
 */

import { logger } from '@/infrastructure/logging/logger'
import { navigationService } from '@/services/navigation-service'

/**
 * 导航工作流接口
 *
 * 定义所有导航操作的标准契约
 */
export interface NavigationWorkflow {
  /** 打开书签整理页面 */
  openManagement(): Promise<void>
  /** 打开设置页面 */
  openSettings(): Promise<void>
  /** 打开侧边栏 */
  openSidePanel(): Promise<void>
}

/**
 * 智能打开设置页面
 * 如果已有 settings 标签页则切换，否则打开新标签页
 */
async function smartOpenSettings(): Promise<void> {
  try {
    // 获取 settings 页面的完整 URL
    const settingsUrl = chrome.runtime.getURL('settings.html')

    // 查询所有标签页
    const tabs = await chrome.tabs.query({})

    logger.debug(
      'Navigation',
      `查找settings标签页, 目标URL: ${settingsUrl}, 总标签数: ${tabs.length}`
    )

    // 查找已打开的 settings 页面
    const existingTab = tabs.find(tab => {
      if (!tab.url) return false
      try {
        const tabUrlObj = new URL(tab.url)
        const settingsUrlObj = new URL(settingsUrl)

        // 必须满足：chrome-extension 协议 + 相同扩展ID + 路径是 /settings.html
        const isMatch =
          tabUrlObj.protocol === 'chrome-extension:' &&
          tabUrlObj.origin === settingsUrlObj.origin &&
          tabUrlObj.pathname === '/settings.html'

        if (isMatch) {
          logger.info('Navigation', `找到匹配的settings标签页: ${tab.url}`)
        }

        return isMatch
      } catch (error) {
        logger.warn('Navigation', `解析标签页URL失败: ${tab.url}`, error)
        return false
      }
    })

    if (existingTab?.id) {
      // 如果已存在，激活该标签页
      logger.info('Navigation', `切换到已存在的settings标签页 (ID: ${existingTab.id})`)
      await chrome.tabs.update(existingTab.id, { active: true })

      // 将焦点切换到该标签页所在的窗口
      if (existingTab.windowId) {
        await chrome.windows.update(existingTab.windowId, { focused: true })
      }
      return
    }

    // 如果不存在，打开新标签页
    logger.info('Navigation', '未找到settings标签页，打开新标签页')
    await navigationService.openExtensionUrl('settings.html')
  } catch (error) {
    logger.warn('Navigation', '智能打开settings失败，降级为直接打开', error)
    await navigationService.openExtensionUrl('settings.html')
  }
}

/**
 * 导航工作流实现
 *
 * 封装具体的导航逻辑
 */
const workflow: NavigationWorkflow = {
  async openManagement() {
    await navigationService.openExtensionUrl('management.html')
  },
  async openSettings() {
    await smartOpenSettings()
  },
  async openSidePanel() {
    await navigationService.openSidePanel()
  }
}

/**
 * 打开书签整理页面
 *
 * 在新标签页中打开整理页面，错误会被记录但不会抛出
 */
export async function openManagementPage(): Promise<void> {
  try {
    await workflow.openManagement()
  } catch (error) {
    logger.warn('Navigation', '打开书签整理页面失败', error)
  }
}

/**
 * 打开设置页面
 *
 * 在新标签页中打开设置页面，错误会被记录但不会抛出
 */
export async function openSettingsPage(): Promise<void> {
  try {
    await workflow.openSettings()
  } catch (error) {
    logger.warn('Navigation', '打开设置页面失败', error)
  }
}

/**
 * 打开侧边栏
 *
 * 打开侧边栏，错误会被记录但不会抛出
 */
export async function openSidePanel(): Promise<void> {
  try {
    await workflow.openSidePanel()
  } catch (error) {
    logger.warn('Navigation', '打开侧边栏失败', error)
  }
}
