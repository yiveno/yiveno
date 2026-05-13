/**
 * 主题同步 Composable
 *
 * 职责：
 * - 监听主题变化事件（mitt 事件总线）
 * - 监听 chrome.storage 变化（跨页面同步）
 * - 自动应用主题到当前页面
 *
 * 使用场景：
 * - 在 popup、sidepanel、management 等页面中使用
 * - 确保所有页面的主题保持同步
 */

import { onMounted, onUnmounted } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { onEvent } from '@/infrastructure/events/event-bus'
import type { ThemeMode } from '@/infrastructure/global-state/global-state-manager'

/**
 * 应用主题到页面
 * @param theme 主题模式
 */
function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement

  if (theme === 'dark') {
    root.style.colorScheme = 'dark'
    root.setAttribute('data-theme', 'dark')
  } else if (theme === 'light') {
    root.style.colorScheme = 'light'
    root.setAttribute('data-theme', 'light')
  }

  logger.debug('useThemeSync', '主题已应用', { theme })
}

/**
 * 主题同步 Composable
 *
 * @param pageName 页面名称（用于日志）
 */
export function useThemeSync(pageName: string): void {
  let storageListener: ((
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => void) | null = null

  onMounted(() => {
    logger.info('useThemeSync', `${pageName} 页面开始监听主题变化`)

    // 1. 监听 mitt 事件总线的主题变化（同一页面内的组件通信）
    const unsubscribeThemeChanged = onEvent('theme:changed', data => {
      logger.info('useThemeSync', `${pageName} 收到主题变化事件`, data)
      const payload = data as { theme?: 'light' | 'dark' }
      if (payload.theme) {
        applyTheme(payload.theme)
      }
    })

    // 2. 监听 chrome.storage 变化（跨页面同步）
    storageListener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      // 只处理 local storage 的主题变化
      if (areaName === 'local' && changes.theme) {
        const newTheme = changes.theme.newValue as ThemeMode
        logger.info(
          'useThemeSync',
          `${pageName} 检测到 chrome.storage 主题变化`,
          {
            oldValue: changes.theme.oldValue,
            newValue: newTheme
          }
        )

        if (newTheme === 'dark' || newTheme === 'light') {
          applyTheme(newTheme)
        }
      }
    }

    // 注册 chrome.storage 监听器
    try {
      if (chrome?.storage?.onChanged) {
        chrome.storage.onChanged.addListener(storageListener)
        logger.debug('useThemeSync', `${pageName} chrome.storage 监听器已注册`)
      }
    } catch (error) {
      logger.warn('useThemeSync', `${pageName} 注册 chrome.storage 监听器失败`, error)
    }

    // 返回清理函数
    onUnmounted(() => {
      logger.info('useThemeSync', `${pageName} 页面停止监听主题变化`)

      // 清理 mitt 事件监听
      unsubscribeThemeChanged()

      // 清理 chrome.storage 监听
      if (storageListener && chrome?.storage?.onChanged) {
        try {
          chrome.storage.onChanged.removeListener(storageListener)
          logger.debug('useThemeSync', `${pageName} chrome.storage 监听器已移除`)
        } catch (error) {
          logger.warn('useThemeSync', `${pageName} 移除 chrome.storage 监听器失败`, error)
        }
      }
    })
  })
}
