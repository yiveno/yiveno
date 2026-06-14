/**
 * 背景脚本生命周期管理
 *
 * 负责响应 chrome.runtime.onInstalled、onStartup 等事件，
 * 根据当前扩展状态执行首次安装、架构升级、数据恢复等流程。
 */

import { logger } from '@/infrastructure/logging/logger'
import type { ExtensionState } from './state'
import { CURRENT_SCHEMA_VERSION, getExtensionState, updateExtensionState } from './state'
import { bookmarkSyncService } from '@/infrastructure/services/bookmark-sync-service'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import { registerEmbeddingSyncTriggers } from '@/background/managers/embedding-sync'
import { dispatchOffscreenRequest } from '@/infrastructure/offscreen/manager'
import {
  registerRetrievalProfileSyncTriggers,
  runRetrievalProfileThenEmbedding
} from '@/background/managers/retrieval-profile-sync'

/**
 * 通过 Offscreen Document 同步文件夹向量
 *
 * ONNX WASM 在 Service Worker 中加载不可靠，改到 Offscreen 中执行。
 */
async function syncFolderVectorsViaOffscreen(): Promise<void> {
  try {
    logger.info('Bootstrap', '开始同步文件夹向量（Offscreen）...')
    await dispatchOffscreenRequest<{ success: boolean }>(
      { type: 'SYNC_FOLDER_VECTORS' },
      { timeout: 300_000 }
    )
    logger.info('Bootstrap', '文件夹向量同步完成')
  } catch (error) {
    logger.warn('Bootstrap', '文件夹向量同步失败（非致命，AI 功能可能受限）', error)
  }
}

/**
 * 首次安装流程处理
 *
 * 执行步骤：
 * 1. 打开引导页
 * 2. 初始化 IndexedDB
 * 3. 同步所有书签（同时广播进度）
 * 4. 更新扩展状态
 *
 * @param reason - 安装原因（install/update等）
 */
async function handleFirstInstall(reason: string): Promise<void> {
  logger.info('Bootstrap', '首次安装：开始全量同步')

  // 1. 打开引导页
  chrome.tabs.create({ url: 'onboarding.html' })

  // 2. 监听并广播进度
  // 注意：这里的 unsubscribe 需要在同步完成后调用
  const unsubscribe = bookmarkSyncService.onProgress(progress => {
    // 广播进度给前端页面（引导页）
    chrome.runtime
      .sendMessage({
        type: 'ottersage-sync-progress',
        data: progress
      })
      .catch(() => {
        // 忽略错误（例如没有页面在监听）
      })
  })

  try {
    await indexedDBManager.initialize()
    await bookmarkSyncService.syncAllBookmarks()

    // ✅ 同步文件夹向量（AI 功能需要）
    // 通过 Offscreen Document 执行，避免 SW 中加载 ONNX WASM 失败
    await syncFolderVectorsViaOffscreen()

    // ✅ 同步书签 embedding（语义搜索需要）
    // 异步执行，不阻塞主流程
    void runRetrievalProfileThenEmbedding('first-install')

    // ✅ 从 IndexedDB 查询实际的书签总数（不依赖已废弃的 bookmarksCount 字段）
    const allBookmarks = await indexedDBManager.getAllBookmarks()
    const totalBookmarks = allBookmarks.filter(node => node.url && !node.isFolder).length

    await updateExtensionState({
      initialized: true,
      dbReady: true,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      bookmarkCount: totalBookmarks,
      lastSyncedAt: Date.now(),
      installReason: reason
    })

    logger.info('Bootstrap', '首次安装完成', { totalBookmarks })
  } finally {
    unsubscribe()
  }
}

/**
 * 架构升级流程处理
 *
 * 当检测到 schema 版本更新时执行升级操作
 *
 * @param state - 当前扩展状态
 */
async function handleSchemaUpgrade(state: ExtensionState): Promise<void> {
  logger.info('Bootstrap', `架构升级：v${state.schemaVersion} → v${CURRENT_SCHEMA_VERSION}`)

  // ✅ 直接执行升级操作，移除无意义的固定延迟
  await indexedDBManager.initialize()

  // ✅ 从 IndexedDB 查询实际的书签总数（不依赖已废弃的 bookmarksCount 字段）
  let allBookmarks = await indexedDBManager.getAllBookmarks()
  let totalBookmarks = allBookmarks.filter(node => node.url && !node.isFolder).length

  if (totalBookmarks === 0) {
    logger.warn('Bootstrap', '升级后书签为空，执行全量重建')
    await bookmarkSyncService.syncAllBookmarks()
    allBookmarks = await indexedDBManager.getAllBookmarks()
    totalBookmarks = allBookmarks.filter(node => node.url && !node.isFolder).length
  }

  // ✅ 同步文件夹向量（AI 功能需要）
  await syncFolderVectorsViaOffscreen()

  // ✅ 同步书签 embedding（语义搜索需要）
  void runRetrievalProfileThenEmbedding('schema-upgrade')

  await updateExtensionState({
    dbReady: true,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    bookmarkCount: totalBookmarks,
    lastSyncedAt: Date.now()
  })

  logger.info('Bootstrap', '架构升级完成', { totalBookmarks })
}

/**
 * 检查 IndexedDB 健康状态
 *
 * 检查逻辑：
 * 1. 尝试初始化 IndexedDB
 * 2. 读取少量数据验证数据库可访问
 * 3. 对比 storage 中的记录数和实际数据
 *
 * @returns true 如果数据库健康，false 如果需要重新同步
 */
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    logger.debug('Bootstrap', '🔍 开始数据库健康检查...')

    // 1. 尝试初始化 IndexedDB
    await indexedDBManager.initialize()

    // 2. 尝试读取少量数据（只读 10 条，快速检查）
    const sampleBookmarks = await indexedDBManager.getAllBookmarks(10)

    // 3. 获取 storage 中记录的书签数量
    const state = await getExtensionState()

    // 4. 数据一致性检查
    if (state.bookmarkCount > 0 && sampleBookmarks.length === 0) {
      logger.warn('Bootstrap', '⚠️ 数据不一致：storage 显示有书签但 IndexedDB 为空', {
        storageCount: state.bookmarkCount,
        actualCount: 0
      })
      return false
    }

    // 5. 如果 storage 说有很多书签，但实际只读到很少，可能数据损坏
    if (state.bookmarkCount > 100 && sampleBookmarks.length < 5) {
      logger.warn('Bootstrap', '⚠️ 数据可能损坏：预期书签数量与实际不符', {
        storageCount: state.bookmarkCount,
        sampleCount: sampleBookmarks.length
      })
      return false
    }

    logger.debug('Bootstrap', '✅ 数据库健康检查通过', {
      storageCount: state.bookmarkCount,
      sampleCount: sampleBookmarks.length
    })

    return true
  } catch (error) {
    logger.error('Bootstrap', '❌ 数据库健康检查失败', error)
    // 检查失败视为不健康，触发恢复
    return false
  }
}

/**
 * 数据丢失恢复流程
 */
async function handleDataRecovery(): Promise<void> {
  logger.warn('Bootstrap', '检测到数据丢失，重新同步')
  await indexedDBManager.initialize()
  await bookmarkSyncService.syncAllBookmarks()

  // ✅ 同步文件夹向量（AI 功能需要）
  await syncFolderVectorsViaOffscreen()

  void runRetrievalProfileThenEmbedding('data-recovery')

  const allBookmarks = await indexedDBManager.getAllBookmarks()
  const totalBookmarks = allBookmarks.filter(node => node.url && !node.isFolder).length
  await updateExtensionState({
    dbReady: true,
    bookmarkCount: totalBookmarks,
    lastSyncedAt: Date.now()
  })
  logger.info('Bootstrap', '数据恢复完成', { totalBookmarks })
}

/**
 * 常规重新加载流程
 */
async function handleRegularReload(reason: string): Promise<void> {
  logger.info('Bootstrap', '正常重新加载，标记 DB 已就绪')
  await updateExtensionState({ dbReady: true, installReason: reason })

  // ⚠️ 收藏数据同步已移到页面打开时执行
  // Service Worker 环境中不适合执行可能触发 DOM API 的操作
  logger.debug('Bootstrap', '收藏数据同步将在页面打开时执行')

  // ✅ 异步同步书签 embedding（语义搜索需要）
  // 不阻塞主流程，在后台执行
  try {
    await indexedDBManager.initialize()
    const allBookmarks = await indexedDBManager.getAllBookmarks(1)
    if (allBookmarks.length === 0) {
      logger.info('Bootstrap', 'IndexedDB 为空，后台启动全量同步')
      void bookmarkSyncService.syncAllBookmarks()
    } else {
      logger.info('Bootstrap', '检测到书签数据，开始异步同步 embedding')
      void runRetrievalProfileThenEmbedding('regular-reload')

      // ✅ 同步文件夹向量（AI 自动归类需要）
      void syncFolderVectorsViaOffscreen()
    }
  } catch (error) {
    logger.warn('Bootstrap', '检查书签数据失败，跳过 embedding / 文件夹向量同步', error)
  }
}

/**
 * 注册生命周期事件处理器
 *
 * 监听 chrome.runtime 的生命周期事件：
 * - onInstalled: 首次安装、更新、重载
 * - onStartup: 浏览器启动
 *
 * 根据不同情况执行相应的初始化流程
 */
export function registerLifecycleHandlers(): void {
  registerEmbeddingSyncTriggers()
  registerRetrievalProfileSyncTriggers()

  chrome.runtime.onInstalled.addListener(async details => {
    try {
      const reason = details.reason || 'unknown'
      const state = await getExtensionState()

      if (!state.initialized) {
        await handleFirstInstall(reason)
        return
      }

      if (state.schemaVersion < CURRENT_SCHEMA_VERSION) {
        await handleSchemaUpgrade(state)
        return
      }

      // ✅ 新增：数据库健康检查
      // 在检查 bookmarkCount 之前先验证数据库实际状态
      const isHealthy = await checkDatabaseHealth()
      if (!isHealthy) {
        logger.warn('Bootstrap', '🔧 数据库不健康，触发数据恢复流程')
        await handleDataRecovery()
        return
      }

      if (state.bookmarkCount === 0) {
        await handleDataRecovery()
        return
      }

      await handleRegularReload(reason)
    } catch (error) {
      logger.error('Bootstrap', 'onInstalled 流程失败', error)
    }
  })

  chrome.runtime.onStartup?.addListener(async () => {
    try {
      logger.info('Bootstrap', '浏览器启动：进行幂等同步')

      // ✅ 启动时也进行健康检查
      // 如果数据不健康，syncAllBookmarks 会自动恢复
      const isHealthy = await checkDatabaseHealth()
      if (!isHealthy) {
        logger.warn('Bootstrap', '🔧 启动时检测到数据丢失，将触发全量同步恢复')
      }

      await bookmarkSyncService.syncAllBookmarks()

      // ✅ 同步文件夹向量（AI 功能需要）
      await syncFolderVectorsViaOffscreen()

      // ⚠️ 收藏数据同步已移到页面打开时执行
      logger.debug('Bootstrap', '收藏数据同步将在页面打开时执行')

      void runRetrievalProfileThenEmbedding('browser-startup')
    } catch (error) {
      logger.warn('Bootstrap', '浏览器启动同步失败', error)
    }
  })
}
