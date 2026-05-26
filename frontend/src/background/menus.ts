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
import { openManagementPage, openSettingsPage } from './navigation'
import { showSystemNotification } from './notification'
import { autoAddBookmark } from './auto-add-bookmark'

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
            id: 'ab-open-management',
            title: '打开书签整理',
            contexts: ['action']
          })
          chrome.contextMenus?.create?.({
            id: 'ab-open-settings',
            title: '打开设置',
            contexts: ['action']
          })

          // 页面右键菜单 - 添加书签
          chrome.contextMenus?.create?.({
            id: 'ab-add-bookmark',
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

    if (info.menuItemId === 'ab-open-management') {
      logger.info('Menus', '➡️ 打开书签整理页面')
      openManagementPage()
      return
    }
    if (info.menuItemId === 'ab-open-settings') {
      logger.info('Menus', '➡️ 打开设置页面')
      openSettingsPage()
      return
    }
    if (info.menuItemId === 'ab-add-bookmark') {
      logger.info('Menus', '📌 添加书签（右键菜单）')
      await handleQuickAddBookmark(tab, info.linkUrl)
    }
  })

  chrome.commands?.onCommand?.addListener(async command => {
    console.log('⌨️ [DEBUG] 收到快捷键命令', { command })
    logger.info('Menus', '⌨️ 收到快捷键命令', { command })

    switch (command) {
      case 'open-management':
        console.log('➡️ [DEBUG] 打开 Management')
        openManagementPage()
        break
      case 'open-settings':
        console.log('➡️ [DEBUG] 打开 Settings')
        openSettingsPage()
        break
      case 'quick-add-bookmark':
        {
          console.log('🎯 [DEBUG] 触发快速添加书签快捷键')
          logger.info('Menus', '🎯 触发快速添加书签快捷键')
          // 获取当前活动标签页
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          })
          console.log('📍 [DEBUG] 查询到的标签页', activeTab)
          if (activeTab) {
            logger.info('Menus', '找到活动标签页', {
              url: activeTab.url,
              title: activeTab.title
            })
            console.log('✅ [DEBUG] 找到活动标签页，调用 handleQuickAddBookmark')
            await handleQuickAddBookmark(activeTab)
          } else {
            console.warn('⚠️ [DEBUG] 未找到活动标签页')
            logger.warn('Menus', '未找到活动标签页')
          }
        }
        break
      default:
        console.log('❓ [DEBUG] 未知快捷键命令', command)
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
  console.log('🚀 [DEBUG] handleQuickAddBookmark 被调用', { tab, linkUrl })

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

    console.log('📋 [DEBUG] 书签数据', bookmarkData)

    // ✅ 验证 URL
    if (!bookmarkData.url || bookmarkData.url.trim() === '') {
      logger.error('Menus', 'URL 为空，无法添加书签', bookmarkData)
      console.error('❌ [DEBUG] URL 为空', bookmarkData)
      return
    }

    logger.info('Menus', '触发快速添加书签', bookmarkData)
    console.log('✅ [DEBUG] 触发快速添加书签', bookmarkData)

    // ✅ 检查 AI 自动归纳开关
    const settings = await chrome.storage.local.get('aiAutoBookmark')
    const aiAutoEnabled = settings.aiAutoBookmark !== false // 默认 true

    logger.info('Menus', 'AI 自动归纳状态', { enabled: aiAutoEnabled })
    console.log('🤖 [DEBUG] AI 自动归纳状态', { enabled: aiAutoEnabled, settings })

    if (aiAutoEnabled) {
      console.log('➡️ [DEBUG] 进入 AI 自动模式')
      // AI 自动模式：直接添加，不弹窗
      await handleAIAutoAddBookmark(bookmarkData)
      return
    }

    console.log('➡️ [DEBUG] 进入手动模式')
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

    await showBookmarkAddedNotification(result.bookmarkId, result.folderPath)
    logger.info('Menus', '✅ AI 自动添加书签 - 完成', {
      folderId: result.folderId,
      folderPath: result.folderPath
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
  tab: chrome.tabs.Tab,
  bookmarkData: {
    title: string
    url: string
    favIconUrl?: string | undefined
  }
): Promise<void> {
  try {
    // ✅ 检查 URL 是否支持注入 content script
    const url = tab.url || ''
    const isSpecialPage =
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('moz-extension://')

    if (isSpecialPage) {
      // 特殊页面无法注入 content script，直接提示不支持
      void showSystemNotification('此页面类型不支持快速添加书签功能。请在普通网页上使用此功能。', {
        title: '无法添加书签'
      })
      return
    }

    // ✅ 核心功能：必须成功注入，这是书签管理插件的核心功能
    // 前置检查：确保tab状态正常
    if (!tab.id || tab.id < 0) {
      logger.error('Menus', '❌ Tab ID 无效', { tabId: tab.id })
      void showSystemNotification('无法获取当前标签页信息，请刷新页面后重试。', {
        title: '无法添加书签'
      })
      return
    }

    // 检查URL是否有效（避免about:blank等无效状态）
    if (!url || url === 'about:blank' || url === 'about:srcdoc') {
      logger.error('Menus', '❌ URL 无效或页面未加载完成', { url })
      void showSystemNotification('当前页面还未加载完成，请等待页面加载后再试。', {
        title: '无法添加书签'
      })
      return
    }

    // 验证content script文件是否存在（通过runtime.getURL检查）
    const scriptUrl = chrome.runtime.getURL('content/inject-quick-add-dialog.js')
    logger.info('Menus', '准备注入 content script', {
      tabId: tab.id,
      url,
      scriptUrl
    })

    // ✅ 核心注入逻辑：重试机制确保成功（最多5次，每次递增延迟）
    let lastError: Error | null = null
    const maxRetries = 5

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('Menus', `🔄 注入尝试 ${attempt}/${maxRetries}`, {
          tabId: tab.id,
          url: url.substring(0, 100) // 限制日志长度
        })

        // 步骤1: 验证tab仍然有效
        const currentTab = await chrome.tabs.get(tab.id).catch(() => null)
        if (!currentTab || !currentTab.url || currentTab.url !== url) {
          throw new Error(`Tab状态已改变: ${currentTab?.url || '已关闭'}`)
        }

        // 步骤2: 注入 content script（使用完整的文件路径）
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/inject-quick-add-dialog.js']
        })

        logger.info('Menus', '✅ Content script 文件注入成功')

        // 步骤3: 等待脚本加载并验证（最多等待1秒）
        let scriptReady = false
        const maxPingAttempts = 20 // 20次 × 50ms = 1秒
        for (let i = 0; i < maxPingAttempts; i++) {
          try {
            const pingResponse = await chrome.tabs
              .sendMessage(tab.id, {
                type: 'PING_QUICK_ADD_DIALOG'
              })
              .catch(() => null)

            if (pingResponse?.ready) {
              scriptReady = true
              logger.info('Menus', `✅ Content script 已就绪 (等待了 ${i * 50}ms)`)
              break
            }
          } catch {
            // 继续等待脚本加载
          }
          await new Promise(resolve => setTimeout(resolve, 50))
        }

        if (!scriptReady) {
          throw new Error(`Content script未响应心跳检测（等待了${maxPingAttempts * 50}ms）`)
        }

        // 步骤4: 发送显示对话框消息
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'SHOW_QUICK_ADD_DIALOG',
          data: bookmarkData
        })

        if (!response || !response.success) {
          throw new Error(`对话框创建失败: ${response?.error || '未知错误'}`)
        }

        logger.info('Menus', '✅✅✅ 树形对话框已成功显示')
        return // 成功！退出函数
      } catch (error) {
        lastError = error as Error
        const errorDetails = {
          attempt: `${attempt}/${maxRetries}`,
          error: lastError.message,
          url: url.substring(0, 100),
          tabId: tab.id
        }

        logger.warn('Menus', `❌ 注入失败 (尝试 ${attempt}/${maxRetries})`, errorDetails)

        // 如果是最后一次尝试，记录完整错误
        if (attempt === maxRetries) {
          logger.error('Menus', '❌ 所有注入尝试均失败', {
            ...errorDetails,
            stack: lastError.stack,
            finalAttempt: true
          })
        } else {
          // 递增延迟重试：100ms, 200ms, 300ms, 400ms
          const delay = 100 * attempt
          logger.info('Menus', `等待 ${delay}ms 后重试...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // ❌ 所有重试都失败 - 这是严重问题，必须详细记录
    logger.error('Menus', '🚨🚨🚨 核心功能失败：无法添加书签', {
      error: lastError?.message,
      stack: lastError?.stack,
      tabId: tab.id,
      url: url.substring(0, 200),
      allAttemptsFailed: true,
      critical: true
    })

    // 提供详细的用户提示
    void showSystemNotification(
      `无法在当前页面注入对话框。错误: ${lastError?.message || '未知错误'}\n\n请尝试：\n1. 刷新页面后重试\n2. 检查扩展程序权限\n3. 如问题持续，请重启浏览器`,
      { title: '无法添加书签' }
    )
  } catch (error) {
    logger.error('Menus', '手动添加书签失败', error)
  }
}

/**
 * 显示书签已添加通知（带撤销按钮）
 */
async function showBookmarkAddedNotification(
  bookmarkId: string,
  folderPath: string
): Promise<void> {
  try {
    const notificationId = await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('images/icon128.png'),
      title: '✅ 书签已添加',
      message: `已自动添加到：${folderPath}`,
      buttons: [{ title: '撤销' }, { title: '查看' }],
      requireInteraction: false,
      priority: 1
    })

    // 监听通知按钮点击
    const handleNotificationClick = async (clickedNotificationId: string, buttonIndex?: number) => {
      // 只处理当前通知的点击事件
      if (clickedNotificationId !== notificationId) {
        return
      }

      if (buttonIndex === 0) {
        // 撤销：删除书签
        try {
          await chrome.bookmarks.remove(bookmarkId)
          logger.info('Menus', '✅ 书签已撤销', { bookmarkId })
          void showSystemNotification('书签已撤销', { title: '撤销成功' })
        } catch (error) {
          logger.error('Menus', '撤销书签失败', error)
          void showSystemNotification('撤销失败，请手动删除', {
            title: '撤销失败'
          })
        }
      } else if (buttonIndex === 1) {
        // 查看：打开 Management 页面
        const url = chrome.runtime.getURL('management.html')
        await chrome.tabs.create({ url })
      }

      // 清除通知
      await chrome.notifications.clear(notificationId)
      chrome.notifications.onButtonClicked.removeListener(handleNotificationClick)
    }

    chrome.notifications.onButtonClicked.addListener(handleNotificationClick)
  } catch (error) {
    logger.error('Menus', '显示通知失败', error)
  }
}
