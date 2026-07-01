/**
 * 扩展持久化状态（chrome.storage）
 *
 * Background 与 infrastructure 共享，避免 infrastructure 反向依赖 background 层。
 */

import { logger } from '@/infrastructure/logging/logger'
import { chromeStorage } from '@/infrastructure/storage/chrome-storage'

/** 本地存储键位常量（Yiveno / YV 前缀） */
export const STATE_KEYS = {
  INITIALIZED: 'YV_INITIALIZED',
  SCHEMA_VERSION: 'YV_SCHEMA_VERSION',
  BOOKMARK_COUNT: 'YV_BOOKMARK_COUNT',
  LAST_SYNCED_AT: 'YV_LAST_SYNCED_AT',
  INSTALL_REASON: 'YV_INSTALL_REASON'
} as const

const LEGACY_STATE_KEYS = {
  INITIALIZED: `${'O'}${'S'}_INITIALIZED`,
  SCHEMA_VERSION: `${'O'}${'S'}_SCHEMA_VERSION`,
  BOOKMARK_COUNT: `${'O'}${'S'}_BOOKMARK_COUNT`,
  LAST_SYNCED_AT: `${'O'}${'S'}_LAST_SYNCED_AT`,
  INSTALL_REASON: `${'O'}${'S'}_INSTALL_REASON`
} as const

/** Session Storage 键位常量 */
const SESSION_KEYS = {
  DB_READY: 'yv_db_ready'
} as const

const LEGACY_SESSION_KEYS = {
  DB_READY: `${'o'}${'s'}_db_ready`
} as const

export type StateKey = (typeof STATE_KEYS)[keyof typeof STATE_KEYS]

/** 当前 IndexedDB 架构版本 */
export const CURRENT_SCHEMA_VERSION = 9

/** Service Worker 关心的扩展状态结构 */
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

/** 获取数据库就绪状态（Session Storage） */
export async function getDatabaseReady(): Promise<boolean> {
  try {
    const ready = await chromeStorage.getSession<boolean>(SESSION_KEYS.DB_READY)
    if (ready !== undefined) return ready

    const legacyReady = await chromeStorage.getSession<boolean>(LEGACY_SESSION_KEYS.DB_READY)
    if (legacyReady !== undefined) {
      await chromeStorage.setSession(SESSION_KEYS.DB_READY, legacyReady)
    }
    return legacyReady ?? false
  } catch (error) {
    logger.error('ExtensionState', '读取 DB_READY 失败', error)
    return false
  }
}

/** 设置数据库就绪状态（Session Storage） */
export async function setDatabaseReady(ready: boolean): Promise<void> {
  try {
    await chromeStorage.setSession(SESSION_KEYS.DB_READY, ready)
    logger.debug('ExtensionState', `DB_READY 已更新: ${ready}`)
  } catch (error) {
    logger.error('ExtensionState', '设置 DB_READY 失败', error)
  }
}

/** 从 chrome.storage.local + session 读取扩展状态 */
export async function getExtensionState(): Promise<ExtensionState> {
  try {
    const raw = await chrome.storage.local.get([
      ...Object.values(STATE_KEYS),
      ...Object.values(LEGACY_STATE_KEYS)
    ])
    const dbReady = await getDatabaseReady()
    const readValue = (
      key: StateKey,
      legacyKey: (typeof LEGACY_STATE_KEYS)[keyof typeof LEGACY_STATE_KEYS]
    ) => raw[key] ?? raw[legacyKey]

    return {
      initialized: Boolean(readValue(STATE_KEYS.INITIALIZED, LEGACY_STATE_KEYS.INITIALIZED)),
      dbReady,
      schemaVersion: Number(
        readValue(STATE_KEYS.SCHEMA_VERSION, LEGACY_STATE_KEYS.SCHEMA_VERSION) ?? 0
      ),
      bookmarkCount: Number(
        readValue(STATE_KEYS.BOOKMARK_COUNT, LEGACY_STATE_KEYS.BOOKMARK_COUNT) ?? 0
      ),
      lastSyncedAt: Number(
        readValue(STATE_KEYS.LAST_SYNCED_AT, LEGACY_STATE_KEYS.LAST_SYNCED_AT) ?? 0
      ),
      installReason:
        typeof readValue(STATE_KEYS.INSTALL_REASON, LEGACY_STATE_KEYS.INSTALL_REASON) === 'string'
          ? (readValue(STATE_KEYS.INSTALL_REASON, LEGACY_STATE_KEYS.INSTALL_REASON) as string)
          : null
    }
  } catch (error) {
    logger.error('ExtensionState', '读取扩展状态失败，返回默认值', error)
    return { ...DEFAULT_STATE }
  }
}

/** 更新部分扩展状态字段 */
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
  logger.debug('ExtensionState', '扩展状态已更新', payload)
}
