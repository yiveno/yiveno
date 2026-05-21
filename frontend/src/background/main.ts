/**
 * Chrome Service Worker 入口
 * 
 * 初始化顺序（重要性从高到低）：
 * 1. 生命周期处理器（onInstalled, onStartup）
 * 2. 消息处理器（chrome.runtime.onMessage）
 * 3. 书签变化监听器（chrome.bookmarks.*）
 * 4. 菜单和快捷键（chrome.contextMenus, chrome.commands）
 * 5. Omnibox（chrome.omnibox）
 * 6. 后台任务（爬虫、特征检测）
 */

import { logger } from '@/infrastructure/logging/logger'
import { registerLifecycleHandlers } from './bootstrap'
import { registerMessageHandlers } from './messaging'
import { registerMenusAndShortcuts } from './menus'
import { registerOmniboxHandlers } from './omnibox'
import { registerBookmarkChangeListeners } from './bookmarks'
import { initializeBookmarkTraitAutoSync } from '@/services/bookmark-trait-auto-sync'

/**
 * 初始化 Service Worker
 * 
 * 使用分阶段初始化，确保核心功能优先加载
 */
async function initializeServiceWorker() {
  logger.info('Background', '🚀 开始初始化 Service Worker...')

  try {
    // ==================== 阶段 1：核心功能（必须成功） ====================
    logger.info('Background', '📍 阶段 1：注册核心功能...')
    
    // 1.1 生命周期处理器（最高优先级）
    registerLifecycleHandlers()
    logger.debug('Background', '✅ 生命周期处理器已注册')
    
    // 1.2 消息处理器（核心通信）
    registerMessageHandlers()
    logger.debug('Background', '✅ 消息处理器已注册')
    
    // 1.3 书签变化监听器（核心功能）
    registerBookmarkChangeListeners()
    logger.debug('Background', '✅ 书签变化监听器已注册')

    logger.info('Background', '✅ 阶段 1 完成：核心功能已就绪')

    // ==================== 阶段 2：UI 功能（允许失败） ====================
    logger.info('Background', '📍 阶段 2：注册 UI 功能...')
    
    try {
      // 2.1 菜单和快捷键
      registerMenusAndShortcuts()
      logger.debug('Background', '✅ 菜单和快捷键已注册')
    } catch (error) {
      logger.warn('Background', '⚠️ 菜单注册失败（非致命）', error)
    }

    try {
      // 2.2 Omnibox
      registerOmniboxHandlers()
      logger.debug('Background', '✅ Omnibox 已注册')
    } catch (error) {
      logger.warn('Background', '⚠️ Omnibox 注册失败（非致命）', error)
    }

    logger.info('Background', '✅ 阶段 2 完成：UI 功能已就绪')

    // ==================== 阶段 3：后台任务（延迟加载） ====================
    logger.info('Background', '📍 阶段 3：初始化后台任务...')
    
    // 3.1 书签特征自动同步（监听事件）
    try {
      initializeBookmarkTraitAutoSync()
      logger.debug('Background', '✅ 书签特征自动同步已初始化')
    } catch (error) {
      logger.warn('Background', '⚠️ 书签特征自动同步初始化失败（非致命）', error)
    }

    // 3.2 后台爬取管理器（延迟导入，避免阻塞启动）
    // ⚠️ 使用 setTimeout 延迟加载，避免阻塞核心功能
    setTimeout(async () => {
      try {
        const { backgroundCrawlerManager } = await import('./crawler-manager')
        void backgroundCrawlerManager // 触发初始化
        logger.debug('Background', '✅ 后台爬取管理器已初始化')
      } catch (error) {
        logger.warn('Background', '⚠️ 后台爬取管理器初始化失败（非致命）', error)
      }
    }, 1000) // 延迟 1 秒，让核心功能先完成

    logger.info('Background', '✅ 阶段 3 完成：后台任务已启动')

    // ==================== 完成 ====================
    logger.info('Background', '🎉 Service Worker 初始化完成')
    logger.info('Background', '📊 状态：核心功能已就绪，后台任务正在启动')

  } catch (error) {
    // 核心功能初始化失败，这是致命错误
    logger.error('Background', '❌ Service Worker 初始化失败（致命错误）', error)
    throw error
  }
}

// 启动初始化
initializeServiceWorker().catch(error => {
  logger.error('Background', '💥 Service Worker 启动失败', error)
})
