import { ref } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
/**
 * 读取并跟踪 Chrome 扩展快捷键配置
 * @returns {Record<string, string>} 快捷键配置
 */
export function useCommandsShortcuts() {
  const shortcuts = ref<Record<string, string>>({})

  /**
   * 加载快捷键配置
   * @returns {Promise<void>} 加载快捷键配置
   */
  async function loadShortcuts() {
    try {
      const list = await chrome.commands.getAll()
      const map: Record<string, string> = {}
      for (const cmd of list as chrome.commands.Command[]) {
        // cmd.shortcut 为 '' 表示未配置
        if (cmd?.name) {
          map[cmd.name] = (cmd.shortcut || '') as string
        }
      }
      shortcuts.value = map
    } catch (error) {
      logger.error('Component', ' useCommandsShortcuts', 'loadShortcuts', error)
      shortcuts.value = {}
    }
  }

  /**
   * 启动自动刷新
   * @returns {void} 启动自动刷新
   */
  function startAutoRefresh() {
    // Service Worker 环境检查
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    // 当页面重新获得焦点或可见时刷新，确保用户在设置页修改后能实时同步
    const refresh = () => {
      loadShortcuts()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh()
    })
  }

  /**
   * 停止自动刷新
   * @returns {void} 停止自动刷新
   */
  function stopAutoRefresh() {
    window.removeEventListener('focus', loadShortcuts)
  }

  /**
   * 初始化
   * @returns {void} 初始化
   */
  return { shortcuts, loadShortcuts, startAutoRefresh, stopAutoRefresh }
}
