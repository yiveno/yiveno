/**
 * Chrome Storage 抽象层
 *
 * 充分利用 Chrome 现代特性：
 * - chrome.storage.session (Chrome 102+)：会话级临时数据
 * - chrome.storage.local：持久化数据
 * - IndexedDB：大量结构化数据
 *
 * 架构原则：
 * - 根据数据生命周期选择合适的存储方式
 * - 自动降级到旧版 API（兼容性）
 * - 统一的类型安全接口
 */

import { logger } from '@/infrastructure/logging/logger'

/**
 * 存储区域类型
 */
export type StorageArea = 'session' | 'local' | 'sync'

/**
 * 可序列化的数据类型（JSON-safe）
 *
 * Chrome Storage API 只能存储 JSON-safe 的数据
 * 使用 unknown 以便实际使用时可以传入任意类型，但提醒开发者必须是可序列化的
 */
export type SerializableValue = unknown

/**
 * 批量存储项
 */
export type BatchStorageItems = Record<string, SerializableValue>

/**
 * Chrome Storage 服务
 *
 * 🆕 充分利用 Chrome 102+ 的 storage.session API
 */
export class ChromeStorageService {
  /**
   * 检查 storage.session API 是否可用
   */
  private get isSessionStorageAvailable(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.storage?.session
  }

  /**
   * 设置会话级数据
   *
   * 优先使用 chrome.storage.session（Chrome 102+）
   * 降级到 chrome.storage.local（带前缀）
   *
   * @template T - 数据类型，必须是可序列化的
   * @param key - 存储键
   * @param value - 存储值（必须可序列化）
   *
   * @example
   * ```typescript
   * await storage.setSession('currentTab', { id: '123', title: 'Example' })
   * ```
   */
  async setSession<T extends SerializableValue>(key: string, value: T): Promise<void> {
    try {
      if (this.isSessionStorageAvailable) {
        // 🆕 使用 storage.session（自动清理）
        await chrome.storage.session.set({ [key]: value })
        logger.debug('ChromeStorage', `✅ Session 存储成功: ${key}`)
      } else {
        // 降级：使用 local 存储（带前缀标记）
        await chrome.storage.local.set({ [`_session_${key}`]: value })
        logger.debug('ChromeStorage', `⚠️ Session 降级到 Local: ${key}`)
      }
    } catch (error) {
      logger.error('ChromeStorage', `❌ Session 存储失败: ${key}`, error)
      throw error
    }
  }

  /**
   * 获取会话级数据
   *
   * @template T - 数据类型，必须是可序列化的
   * @param key - 存储键
   * @param defaultValue - 默认值（可选）
   * @returns 存储的值，如果不存在则返回默认值或 undefined
   *
   * @example
   * ```typescript
   * const tab = await storage.getSession<TabInfo>('currentTab', null)
   * ```
   */
  async getSession<T extends SerializableValue>(
    key: string,
    defaultValue?: T
  ): Promise<T | undefined> {
    try {
      if (this.isSessionStorageAvailable) {
        const result = await chrome.storage.session.get(key)
        return (result[key] as T) ?? defaultValue
      } else {
        // 降级：从 local 读取
        const result = await chrome.storage.local.get(`_session_${key}`)
        return (result[`_session_${key}`] as T) ?? defaultValue
      }
    } catch (error) {
      logger.error('ChromeStorage', `❌ Session 读取失败: ${key}`, error)
      return defaultValue
    }
  }

  /**
   * 删除会话级数据
   *
   * @param key - 存储键
   *
   * @example
   * ```typescript
   * await storage.removeSession('currentTab')
   * ```
   */
  async removeSession(key: string): Promise<void> {
    try {
      if (this.isSessionStorageAvailable) {
        await chrome.storage.session.remove(key)
      } else {
        await chrome.storage.local.remove(`_session_${key}`)
      }
      logger.debug('ChromeStorage', `✅ Session 删除成功: ${key}`)
    } catch (error) {
      logger.error('ChromeStorage', `❌ Session 删除失败: ${key}`, error)
    }
  }

  /**
   * 设置持久化数据
   *
   * 使用 chrome.storage.local（浏览器关闭后保留）
   *
   * @template T - 数据类型，必须是可序列化的
   * @param key - 存储键
   * @param value - 存储值（必须可序列化）
   *
   * @example
   * ```typescript
   * await storage.setLocal('theme', 'dark')
   * ```
   */
  async setLocal<T extends SerializableValue>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value })
      logger.debug('ChromeStorage', `✅ Local 存储成功: ${key}`)
    } catch (error) {
      logger.error('ChromeStorage', `❌ Local 存储失败: ${key}`, error)
      throw error
    }
  }

  /**
   * 获取持久化数据
   *
   * @template T - 数据类型，必须是可序列化的
   * @param key - 存储键
   * @param defaultValue - 默认值（可选）
   * @returns 存储的值，如果不存在则返回默认值或 undefined
   *
   * @example
   * ```typescript
   * const theme = await storage.getLocal<string>('theme', 'light')
   * ```
   */
  async getLocal<T extends SerializableValue>(
    key: string,
    defaultValue?: T
  ): Promise<T | undefined> {
    try {
      const result = await chrome.storage.local.get(key)
      return (result[key] as T) ?? defaultValue
    } catch (error) {
      logger.error('ChromeStorage', `❌ Local 读取失败: ${key}`, error)
      return defaultValue
    }
  }

  /**
   * 删除持久化数据
   *
   * @param key - 存储键
   *
   * @example
   * ```typescript
   * await storage.removeLocal('theme')
   * ```
   */
  async removeLocal(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key)
      logger.debug('ChromeStorage', `✅ Local 删除成功: ${key}`)
    } catch (error) {
      logger.error('ChromeStorage', `❌ Local 删除失败: ${key}`, error)
    }
  }

  /**
   * 设置跨设备同步数据
   *
   * 使用 chrome.storage.sync（需要登录 Chrome）
   * ⚠️ 注意：有配额限制（100KB 总量，8KB 单项）
   *
   * @template T - 数据类型，必须是可序列化的
   * @param key - 存储键
   * @param value - 存储值（必须可序列化且小于 8KB）
   *
   * @example
   * ```typescript
   * await storage.setSync('userPrefs', { language: 'zh-CN' })
   * ```
   */
  async setSync<T extends SerializableValue>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.sync.set({ [key]: value })
      logger.debug('ChromeStorage', `✅ Sync 存储成功: ${key}`)
    } catch (error) {
      logger.error('ChromeStorage', `❌ Sync 存储失败: ${key}`, error)
      throw error
    }
  }

  /**
   * 获取跨设备同步数据
   *
   * @template T - 数据类型，必须是可序列化的
   * @param key - 存储键
   * @param defaultValue - 默认值（可选）
   * @returns 存储的值，如果不存在则返回默认值或 undefined
   *
   * @example
   * ```typescript
   * const prefs = await storage.getSync<UserPrefs>('userPrefs', {})
   * ```
   */
  async getSync<T extends SerializableValue>(
    key: string,
    defaultValue?: T
  ): Promise<T | undefined> {
    try {
      const result = await chrome.storage.sync.get(key)
      return (result[key] as T) ?? defaultValue
    } catch (error) {
      logger.error('ChromeStorage', `❌ Sync 读取失败: ${key}`, error)
      return defaultValue
    }
  }

  /**
   * 批量设置会话数据
   *
   * @param items - 键值对对象（所有值必须可序列化）
   *
   * @example
   * ```typescript
   * await storage.setBatchSession({
   *   currentTab: { id: '123' },
   *   expandedNodes: ['node1', 'node2']
   * })
   * ```
   */
  async setBatchSession(items: BatchStorageItems): Promise<void> {
    try {
      if (this.isSessionStorageAvailable) {
        await chrome.storage.session.set(items)
      } else {
        const prefixedItems = Object.fromEntries(
          Object.entries(items).map(([k, v]) => [`_session_${k}`, v])
        )
        await chrome.storage.local.set(prefixedItems)
      }
      logger.debug('ChromeStorage', `✅ 批量 Session 存储成功，数量: ${Object.keys(items).length}`)
    } catch (error) {
      logger.error('ChromeStorage', '❌ 批量 Session 存储失败', error)
      throw error
    }
  }

  /**
   * 清空所有会话数据
   */
  async clearAllSession(): Promise<void> {
    try {
      if (this.isSessionStorageAvailable) {
        await chrome.storage.session.clear()
      } else {
        // 降级：清空所有 _session_ 前缀的键
        const allItems = await chrome.storage.local.get(null)
        const sessionKeys = Object.keys(allItems).filter(k => k.startsWith('_session_'))
        if (sessionKeys.length > 0) {
          await chrome.storage.local.remove(sessionKeys)
        }
      }
      logger.info('ChromeStorage', '✅ 所有 Session 数据已清空')
    } catch (error) {
      logger.error('ChromeStorage', '❌ Session 清空失败', error)
    }
  }

  /**
   * 监听存储变化
   *
   * @param callback - 变化回调
   * @param area - 监听的存储区域（可选）
   */
  onChanged(
    callback: (changes: Record<string, chrome.storage.StorageChange>, area: StorageArea) => void,
    area?: StorageArea
  ): () => void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (!area || areaName === area) {
        callback(changes, areaName as StorageArea)
      }
    }

    chrome.storage.onChanged.addListener(listener)

    // 返回取消订阅函数
    return () => {
      chrome.storage.onChanged.removeListener(listener)
    }
  }
}

/**
 * 单例实例
 */
export const chromeStorage = new ChromeStorageService()

/**
 * 推荐使用场景：
 *
 * ## Session Storage (chrome.storage.session)
 * - ✅ 用户当前会话的 UI 状态（折叠/展开、选中项）
 * - ✅ 筛选历史（会话级别）
 * - ✅ 未保存的表单数据
 * - ✅ 临时缓存（API 响应、计算结果）
 * - ✅ 当前标签页的上下文信息
 *
 * ## Local Storage (chrome.storage.local)
 * - ✅ 用户偏好设置（主题、语言）
 * - ✅ 扩展配置
 * - ✅ 离线数据缓存
 * - ✅ 持久化状态
 *
 * ## IndexedDB
 * - ✅ 大量书签数据（2万+条）
 * - ✅ 复杂查询需求
 * - ✅ 结构化数据存储
 */
