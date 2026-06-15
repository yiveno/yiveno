/**
 * 上下文菜单与快捷键注册
 *
 * 职责：
 * - 注册扩展图标的右键菜单
 * - 处理菜单点击事件
 * - 注册键盘快捷键
 * - 处理快捷键命令
 *
 * 功能：
 * - 提供快速访问书签整理页面的菜单
 * - 提供快速访问设置页面的菜单
 * - 支持键盘快捷键操作
 */

import { logger } from '@/infrastructure/logging/logger'
import { openManagementPage, openSettingsPage } from '../managers/navigation'
import { showSystemNotification } from './notification'
import { autoAddBookmark } from '../managers/auto-add-bookmark'
import {
  AI_AUTO_BOOKMARK_STORAGE_KEY,
  isAiAutoBookmarkEnabled
} from '@/core/ai/ai-feature-settings'
import { showBookmarkAddedNotification } from './messaging'

// ✅ 菜单注册状态标记（避免重复注册）
let menusRegistered = false

/**
 * 注册上下文菜单和快捷键
 *
 * 在扩展安装时创建菜单项，并注册相应的事件监听器
 */
export function registerMenusAndShortcuts(): void {
  /**
   * 注册菜单（幂等操作）
   *
   * 使用状态标记确保菜单只注册一次，避免重复注册
   */
  function registerMenus(): void {
    // ✅ 如果已经注册过，跳过
    if (menusRegistered) {
      logger.debug('Menus', '菜单已注册，跳过重复注册')
      return
    }

    try {
      // ✅ 使用 Promise 确保 removeAll 完成后再创建菜单
      chrome.contextMenus?.removeAll?.(() => {
        logger.info('Menus', '🔄 开始注册上下文菜单...')

        try {
          // 扩展图标右键菜单
          chrome.contextMenus?.create?.({
            id: 'os-open-management',
            title: '打开书签整理',
            contexts: ['action']
          })
          chrome.contextMenus?.create?.({
            id: 'os-open-settings',
            title: '打开设置',
            contexts: ['action']
          })

          // 页面右键菜单 - 添加书签
          chrome.contextMenus?.create?.({
            id: 'os-add-bookmark',
            title: '添加到书签...',
            contexts: ['page', 'link']
          })

          // ✅ 标记为已注册
          menusRegistered = true
          logger.info('Menus', '✅ 上下文菜单注册完成')
        } catch (createError) {
          // ✅ 忽略重复创建错误（Service Worker 重启时可能会触发）
          if (createError instanceof Error && createError.message.includes('duplicate')) {
            logger.debug('Menus', '菜单已存在，跳过创建')
            menusRegistered = true // 即使是重复创建，也标记为已注册
          } else {
            logger.error('Menus', '❌ 创建上下文菜单失败', createError)
          }
        }
      })
    } catch (error) {
      logger.error('Menus', '❌ 注册上下文菜单失败', error)
    }
  }

  // ✅ 立即注册菜单（Service Worker 启动时）
  registerMenus()

  // ✅ 扩展安装/更新时重置状态并重新注册
  // 这样可以确保扩展更新后菜单是最新的
  chrome.runtime.onInstalled.addListener(() => {
    logger.info('Menus', '📦 扩展安装/更新，重置菜单状态')
    menusRegistered = false // 重置状态
    registerMenus()
  })

  chrome.contextMenus?.onClicked?.addListener(async (info, tab) => {
    logger.info('Menus', '📋 上下文菜单点击', { menuItemId: info.menuItemId })

    if (info.menuItemId === 'os-open-management') {
      logger.info('Menus', '➡️ 打开书签整理页面')
      void openManagementPage()
      return
    }
    if (info.menuItemId === 'os-open-settings') {
      logger.info('Menus', '➡️ 打开设置页面')
      void openSettingsPage()
      return
    }
    if (info.menuItemId === 'os-add-bookmark') {
      logger.info('Menus', '📌 添加书签（右键菜单）')
      await handleQuickAddBookmark(tab, info.linkUrl)
    }
  })

  chrome.commands?.onCommand?.addListener(async command => {
    logger.info('Menus', '⌨️ 收到快捷键命令', { command })

    switch (command) {
      case 'open-management':
        void openManagementPage()
        break
      case 'open-settings':
        void openSettingsPage()
        break
      case 'quick-add-bookmark':
        {
          logger.info('Menus', '🎯 触发快速添加书签快捷键')
          // 获取当前活动标签页
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          if (activeTab) {
            logger.info('Menus', '找到活动标签页', {
              url: activeTab.url,
              title: activeTab.title
            })
            await handleQuickAddBookmark(activeTab)
          } else {
            console.warn('⚠️ [DEBUG] 未找到活动标签页')
            logger.warn('Menus', '未找到活动标签页')
          }
        }
        break
      default:
        logger.debug('Menus', '收到未知快捷键命令', command)
    }
  })
}

/**
 * 处理快速添加书签
 *
 * @param tab - 当前标签页信息
 * @param linkUrl - 如果是右键链接触发，这是链接 URL
 */
async function handleQuickAddBookmark(
  tab: chrome.tabs.Tab | undefined,
  linkUrl?: string
): Promise<void> {
  if (!tab) {
    logger.warn('Menus', '无法获取当前标签页')
    console.warn('⚠️ [DEBUG] 无法获取当前标签页')
    return
  }

  try {
    // 准备书签数据
    const bookmarkData = {
      title: tab.title || '未命名书签',
      url: linkUrl || tab.url || '',
      ...(tab.favIconUrl ? { favIconUrl: tab.favIconUrl } : {})
    }

    // ✅ 验证 URL
    if (!bookmarkData.url || bookmarkData.url.trim() === '') {
      logger.error('Menus', 'URL 为空，无法添加书签', bookmarkData)
      console.error('❌ [DEBUG] URL 为空', bookmarkData)
      return
    }

    logger.info('Menus', '触发快速添加书签', bookmarkData)

    // ✅ 检查 AI 自动归纳开关
    const settings = await chrome.storage.local.get([AI_AUTO_BOOKMARK_STORAGE_KEY])
    const aiAutoEnabled = isAiAutoBookmarkEnabled(settings[AI_AUTO_BOOKMARK_STORAGE_KEY])

    logger.info('Menus', 'AI 自动归纳状态', {
      aiAutoEnabled,
      settings
    })

    if (aiAutoEnabled) {
      // AI 自动模式：直接添加，不弹窗
      await handleAIAutoAddBookmark(bookmarkData)
      return
    }

    // 手动模式：显示对话框
    await handleManualAddBookmark(tab, bookmarkData)
  } catch (error) {
    logger.error('Menus', '处理添加书签失败', error)
    console.error('❌ [DEBUG] 处理添加书签失败', error)
  }
}

/**
 * AI 自动添加书签（不弹窗）
 */
async function handleAIAutoAddBookmark(bookmarkData: {
  title: string
  url: string
  favIconUrl?: string | undefined
}): Promise<void> {
  try {
    logger.info('Menus', '🤖 AI 自动添加书签 - 开始', bookmarkData)
    const result = await autoAddBookmark(bookmarkData)

    if (!result.success || !result.bookmarkId || !result.folderPath) {
      throw new Error(result.error || '添加失败')
    }

    // 通知异步触发，不阻塞调用
    void showBookmarkAddedNotification(result.bookmarkId, result.folderPath, result.aiUsed)
    logger.info('Menus', '✅ AI 自动添加书签 - 完成', {
      folderId: result.folderId,
      folderPath: result.folderPath,
      aiUsed: result.aiUsed
    })
  } catch (error) {
    logger.error('Menus', '❌ AI 自动添加书签失败', error)
    void showSystemNotification('添加书签失败，请稍后重试', {
      title: '添加失败'
    })
  }
}

/**
 * 手动添加书签（显示对话框）
 */
async function handleManualAddBookmark(
  _tab: chrome.tabs.Tab,
  bookmarkData: {
    title: string
    url: string
    favIconUrl?: string | undefined
  }
): Promise<void> {
  try {
    // ✅ 使用 chrome.windows.create 打开独立弹窗
    const popupUrl = chrome.runtime.getURL(
      'save-popup.html?' +
        `title=${encodeURIComponent(bookmarkData.title)}&` +
        `url=${encodeURIComponent(bookmarkData.url)}&` +
        `favIconUrl=${encodeURIComponent(bookmarkData.favIconUrl || '')}`
    )

    logger.info('Menus', '打开添加书签弹窗', {
      popupUrl,
      title: bookmarkData.title,
      url: bookmarkData.url
    })

    // 获取当前窗口信息以计算居中位置
    const currentWindow = await chrome.windows.getCurrent()
    const screenWidth = currentWindow.width || screen.width
    const screenHeight = currentWindow.height || screen.height
    const popupWidth = 420
    const popupHeight = 520

    // 计算居中位置
    const left = Math.round((screenWidth - popupWidth) / 2)
    const top = Math.round((screenHeight - popupHeight) / 2)

    await chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: popupWidth,
      height: popupHeight,
      left,
      top,
      focused: true
    })

    logger.info('Menus', '✅ 添加书签弹窗已打开')
  } catch (error) {
    logger.error('Menus', '❌ 打开添加书签弹窗失败', error)
    void showSystemNotification('打开添加书签弹窗失败，请稍后重试', {
      title: '打开弹窗失败'
    })
  }
}
