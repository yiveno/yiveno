/**
 * 扩展状态管理模块
 *
 * 负责：
 * 1. 定义 Service Worker 需要持久化的关键状态字段
 * 2. 提供读取与部分更新的便捷方法
 * 3. 统一当前数据库架构版本，方便生命周期逻辑引用
 *
 * Session Storage：`dbReady` 为会话级临时运行状态
 */

import { logger } from '@/infrastructure/logging/logger'
import { chromeStorage } from '@/infrastructure/storage/chrome-storage'

/**
 * 本地存储键位常量（otterSage / OS 前缀）
 */
export const STATE_KEYS = {
  INITIALIZED: 'OS_INITIALIZED',
  SCHEMA_VERSION: 'OS_SCHEMA_VERSION',
  BOOKMARK_COUNT: 'OS_BOOKMARK_COUNT',
  LAST_SYNCED_AT: 'OS_LAST_SYNCED_AT',
  INSTALL_REASON: 'OS_INSTALL_REASON'
} as const

/**
 * Session Storage 键位常量
 */
const SESSION_KEYS = {
  DB_READY: 'os_db_ready'
} as const

export type StateKey = (typeof STATE_KEYS)[keyof typeof STATE_KEYS]

/**
 * 当前 IndexedDB 架构版本
 * 每次 schema 演进都需要同步更新该常量，以便 onInstalled/onStartup 判定是否需要迁移
 */
export const CURRENT_SCHEMA_VERSION = 9

/**
 * Service Worker 关心的扩展状态结构
 */
export interface ExtensionState {
  initialized: boolean
  dbReady: boolean
  schemaVersion: number
  bookmarkCount: number
  lastSyncedAt: number
  installReason: string | null
}

const DEFAULT_STATE: ExtensionState = {
  initialized: false,
  dbReady: false,
  schemaVersion: 0,
  bookmarkCount: 0,
  lastSyncedAt: 0,
  installReason: null
}

/**
 * 获取数据库就绪状态（Session Storage）
 */
export async function getDatabaseReady(): Promise<boolean> {
  try {
    const ready = await chromeStorage.getSession<boolean>(SESSION_KEYS.DB_READY, false)
    return ready ?? false
  } catch (error) {
    logger.error('BackgroundState', '读取 DB_READY 失败', error)
    return false
  }
}

/**
 * 设置数据库就绪状态（Session Storage）
 */
export async function setDatabaseReady(ready: boolean): Promise<void> {
  try {
    await chromeStorage.setSession(SESSION_KEYS.DB_READY, ready)
    logger.debug('BackgroundState', `DB_READY 已更新: ${ready}`)
  } catch (error) {
    logger.error('BackgroundState', '设置 DB_READY 失败', error)
  }
}

/**
 * 从 chrome.storage.local + session 读取扩展状态
 */
export async function getExtensionState(): Promise<ExtensionState> {
  try {
    const raw = await chrome.storage.local.get(Object.values(STATE_KEYS))
    const dbReady = await getDatabaseReady()

    return {
      initialized: Boolean(raw[STATE_KEYS.INITIALIZED]),
      dbReady,
      schemaVersion: Number(raw[STATE_KEYS.SCHEMA_VERSION] ?? 0),
      bookmarkCount: Number(raw[STATE_KEYS.BOOKMARK_COUNT] ?? 0),
      lastSyncedAt: Number(raw[STATE_KEYS.LAST_SYNCED_AT] ?? 0),
      installReason:
        typeof raw[STATE_KEYS.INSTALL_REASON] === 'string'
          ? (raw[STATE_KEYS.INSTALL_REASON] as string)
          : null
    }
  } catch (error) {
    logger.error('BackgroundState', '读取扩展状态失败，返回默认值', error)
    return { ...DEFAULT_STATE }
  }
}

/**
 * 更新部分扩展状态字段
 */
export async function updateExtensionState(updates: Partial<ExtensionState>): Promise<void> {
  const payload: Partial<Record<StateKey, unknown>> = {}

  if (updates.initialized !== undefined) {
    payload[STATE_KEYS.INITIALIZED] = updates.initialized
  }

  if (updates.dbReady !== undefined) {
    await setDatabaseReady(updates.dbReady)
  }

  if (updates.schemaVersion !== undefined) {
    payload[STATE_KEYS.SCHEMA_VERSION] = updates.schemaVersion
  }
  if (updates.bookmarkCount !== undefined) {
    payload[STATE_KEYS.BOOKMARK_COUNT] = updates.bookmarkCount
  }
  if (updates.lastSyncedAt !== undefined) {
    payload[STATE_KEYS.LAST_SYNCED_AT] = updates.lastSyncedAt
  }
  if (updates.installReason !== undefined) {
    payload[STATE_KEYS.INSTALL_REASON] = updates.installReason
  }

  if (Object.keys(payload).length === 0) {
    return
  }

  await chrome.storage.local.set(payload)
  logger.debug('BackgroundState', '扩展状态已更新', payload)
}
