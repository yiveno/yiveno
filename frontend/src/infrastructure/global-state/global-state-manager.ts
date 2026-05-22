/**
 * 全局状态管理器 - 使用 chrome.storage
 *
 * 职责：
 * - 统一管理全局状态（主题、语言、用户偏好设置等）
 * - 使用 chrome.storage.local 存储（快速访问）
 * - 使用 chrome.storage.sync 存储需要跨设备同步的设置
 * - 提供类型安全的API接口
 * - 支持实时状态监听和更新
 */

import {
  normalizeColorPresetId,
  type ColorPresetId
} from '@acuity-bookmarks/design-tokens/color-presets'

import { emitEvent } from '../events/event-bus'
import { logger } from '../logging/logger'

/**
 * 主题模式类型
 *
 * 支持三种模式：
 * - 'system': 跟随系统主题
 * - 'light': 明亮主题
 * - 'dark': 暗黑主题
 */
export type ThemeMode = 'system' | 'light' | 'dark'

/**
 * 全局状态接口
 *
 * 定义应用的全局配置和用户偏好
 */
export interface GlobalState {
  /** 主题设置 */
  theme: ThemeMode

  /** Material 3 配色预设（与亮/暗主题正交） */
  colorPreset: ColorPresetId

  /** 是否自动同步 */
  autoSync: boolean
  /** 是否显示网站图标 */
  showFavicons: boolean
  /** 是否使用紧凑模式 */
  compactMode: boolean
  /** 是否自动跟随系统主题 */
  autoFollowSystemTheme: boolean
}

/**
 * 默认全局状态
 *
 * 初始化和重置时使用的默认值
 */
const DEFAULT_STATE: GlobalState = {
  theme: 'system', // 默认跟随系统主题
  colorPreset: 'default',
  autoSync: true,
  showFavicons: true,
  compactMode: false,
  autoFollowSystemTheme: false // 已废弃，保留用于兼容旧数据
}

/**
 * Chrome Storage 键名常量
 *
 * 区分本地存储和同步存储的键名
 */
const STORAGE_KEYS = {
  /** 本地存储键名（快速访问，不跨设备同步） */
  LOCAL: {
    THEME: 'theme',
    COLOR_PRESET: 'colorPreset',
    AUTO_SYNC: 'autoSync',
    SHOW_FAVICONS: 'showFavicons',
    COMPACT_MODE: 'compactMode',
    AUTO_FOLLOW_SYSTEM_THEME: 'autoFollowSystemTheme'
  },
  /** 同步存储键名（跨设备同步） */
  SYNC: {
    THEME: 'theme',
    COLOR_PRESET: 'colorPreset'
  }
} as const

/**
 * 全局状态管理器类
 *
 * 单例模式管理应用的全局状态，使用 chrome.storage 持久化
 */
export class GlobalStateManager {
  /** 单例实例 */
  private static instance: GlobalStateManager | null = null
  /** 当前状态 */
  private state: GlobalState
  /** 状态变更监听器列表 */
  private listeners: Array<(state: GlobalState) => void>
  /** 初始化状态标记 */
  private initialized: boolean

  /**
   * 私有构造函数
   *
   * 强制使用单例模式，避免多实例导致状态不一致
   */
  private constructor() {
    // 私有构造函数，强制使用单例模式
    // 显式初始化所有属性，避免响应式系统问题
    this.state = { ...DEFAULT_STATE }
    this.listeners = []
    this.initialized = false
  }

  private ensureTheme(value: unknown, fallback: ThemeMode = DEFAULT_STATE.theme): ThemeMode {
    return value === 'light' || value === 'dark' || value === 'system'
      ? (value as ThemeMode)
      : fallback
  }

  private ensureBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback
  }

  private ensureColorPreset(
    value: unknown,
    fallback: ColorPresetId = DEFAULT_STATE.colorPreset
  ): ColorPresetId {
    return normalizeColorPresetId(value ?? fallback)
  }

  private normalizeState(rawState: Partial<GlobalState>): GlobalState {
    const fallback = this.state ?? DEFAULT_STATE
    return {
      theme: this.ensureTheme(rawState.theme, fallback.theme),
      colorPreset: this.ensureColorPreset(rawState.colorPreset, fallback.colorPreset),
      autoSync: this.ensureBoolean(rawState.autoSync, fallback.autoSync),
      showFavicons: this.ensureBoolean(rawState.showFavicons, fallback.showFavicons),
      compactMode: this.ensureBoolean(rawState.compactMode, fallback.compactMode),
      autoFollowSystemTheme: this.ensureBoolean(
        rawState.autoFollowSystemTheme,
        fallback.autoFollowSystemTheme
      )
    }
  }

  /**
   * 获取全局状态管理器实例（单例）
   *
   * @returns 全局状态管理器实例
   */
  static getInstance(): GlobalStateManager {
    if (!GlobalStateManager.instance) {
      GlobalStateManager.instance = new GlobalStateManager()
    }
    return GlobalStateManager.instance
  }

  /**
   * 初始化全局状态管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      logger.info('GlobalStateManager', '初始化全局状态管理器...')

      // 从chrome.storage加载状态
      await this.loadState()

      // 监听存储变化
      this.setupStorageListener()

      this.initialized = true
      logger.info('GlobalStateManager', '全局状态管理器初始化完成', this.state)
    } catch (error) {
      logger.error('GlobalStateManager', '初始化失败', error)
      // 即使失败也标记为已初始化，使用默认状态
      this.initialized = true
    }
  }

  /**
   * 从chrome.storage加载状态
   */
  private async loadState(): Promise<void> {
    try {
      // 先设置默认状态，确保 state 始终有值
      this.state = { ...DEFAULT_STATE }

      // 并行加载本地和同步存储
      const [localResult, syncResult] = await Promise.all([
        this.getStorageData(Object.values(STORAGE_KEYS.LOCAL), 'local'),
        this.getStorageData(Object.values(STORAGE_KEYS.SYNC), 'sync')
      ])

      // 合并状态，优先使用同步存储的数据（跨设备同步优先）
      this.state = this.normalizeState({
        ...DEFAULT_STATE,
        ...localResult,
        ...syncResult
      })

      logger.debug('GlobalStateManager', '状态加载完成', this.state)
    } catch (error) {
      logger.error('GlobalStateManager', '状态加载失败，使用默认状态', error)
      this.state = { ...DEFAULT_STATE }
    }
  }

  /**
   * 设置存储监听器
   */
  private setupStorageListener(): void {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        this.handleStorageChange(changes, namespace)
      })
    }
  }

  /**
   * 处理存储变化
   */
  private handleStorageChange(
    changes: { [key: string]: chrome.storage.StorageChange },
    namespace: string
  ): void {
    let stateChanged = false
    const newState = { ...this.state }

    Object.keys(changes).forEach(key => {
      const change = changes[key]
      if (change?.newValue !== undefined) {
        // 根据命名空间和键名更新对应状态
        if (namespace === 'local') {
          switch (key) {
            case STORAGE_KEYS.LOCAL.THEME: {
              const nextTheme = this.ensureTheme(change.newValue, newState.theme)
              if (nextTheme !== newState.theme) {
                newState.theme = nextTheme
                stateChanged = true
              }
              break
            }

            case STORAGE_KEYS.LOCAL.COLOR_PRESET: {
              const nextPreset = this.ensureColorPreset(change.newValue, newState.colorPreset)
              if (nextPreset !== newState.colorPreset) {
                newState.colorPreset = nextPreset
                stateChanged = true
              }
              break
            }

            case STORAGE_KEYS.LOCAL.AUTO_SYNC: {
              const nextAutoSync = this.ensureBoolean(change.newValue, newState.autoSync)
              if (nextAutoSync !== newState.autoSync) {
                newState.autoSync = nextAutoSync
                stateChanged = true
              }
              break
            }
            case STORAGE_KEYS.LOCAL.SHOW_FAVICONS: {
              const nextShowFavicons = this.ensureBoolean(change.newValue, newState.showFavicons)
              if (nextShowFavicons !== newState.showFavicons) {
                newState.showFavicons = nextShowFavicons
                stateChanged = true
              }
              break
            }
            case STORAGE_KEYS.LOCAL.COMPACT_MODE: {
              const nextCompactMode = this.ensureBoolean(change.newValue, newState.compactMode)
              if (nextCompactMode !== newState.compactMode) {
                newState.compactMode = nextCompactMode
                stateChanged = true
              }
              break
            }
            case STORAGE_KEYS.LOCAL.AUTO_FOLLOW_SYSTEM_THEME: {
              const nextAutoFollow = this.ensureBoolean(
                change.newValue,
                newState.autoFollowSystemTheme
              )
              if (nextAutoFollow !== newState.autoFollowSystemTheme) {
                newState.autoFollowSystemTheme = nextAutoFollow
                stateChanged = true
              }
              break
            }
          }
        } else if (namespace === 'sync') {
          switch (key) {
            case STORAGE_KEYS.SYNC.THEME: {
              const nextTheme = this.ensureTheme(change.newValue, newState.theme)
              if (nextTheme !== newState.theme) {
                newState.theme = nextTheme
                stateChanged = true
              }
              break
            }

            case STORAGE_KEYS.SYNC.COLOR_PRESET: {
              const nextPreset = this.ensureColorPreset(change.newValue, newState.colorPreset)
              if (nextPreset !== newState.colorPreset) {
                newState.colorPreset = nextPreset
                stateChanged = true
              }
              break
            }
          }
        }
      }
    })

    if (stateChanged) {
      this.state = newState
      this.notifyListeners()
      logger.debug('GlobalStateManager', '状态已更新', newState)
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const stateCopy = { ...this.state }
    this.listeners.forEach(listener => {
      try {
        listener(stateCopy)
      } catch (error) {
        logger.error('GlobalStateManager', '通知监听器失败', error)
      }
    })
  }

  /**
   * 获取存储数据
   */
  private async getStorageData(
    keys: string[],
    area: 'local' | 'sync' = 'local'
  ): Promise<Partial<GlobalState>> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return {}
    }

    const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local

    return new Promise(resolve => {
      storage.get(keys, result => {
        if (chrome.runtime.lastError) {
          logger.error('GlobalStateManager', `获取${area}存储失败`, chrome.runtime.lastError)
          resolve({})
          return
        }
        resolve(result as Partial<GlobalState>)
      })
    })
  }

  /**
   * 设置存储数据
   */
  private async setStorageData(
    key: string,
    value: unknown,
    area: 'local' | 'sync' = 'local'
  ): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      throw new Error('Chrome storage not available')
    }

    const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local

    return new Promise((resolve, reject) => {
      storage.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError)
          return
        }
        resolve()
      })
    })
  }

  // ===== 公共API =====

  /**
   * 获取当前全局状态
   */
  getState(): GlobalState {
    // 确保总是返回有效的状态对象
    if (!this.state) {
      logger.warn('GlobalStateManager', 'state 未初始化，返回默认状态')
      return { ...DEFAULT_STATE }
    }
    return { ...this.state }
  }

  /**
   * 获取主题
   */
  getTheme(): ThemeMode {
    return this.state?.theme ?? DEFAULT_STATE.theme
  }

  /**
   * 获取配色预设
   */
  getColorPreset(): ColorPresetId {
    return this.state?.colorPreset ?? DEFAULT_STATE.colorPreset
  }

  /**
   * 设置配色预设（写入 local + sync，并广播 `colorPreset:changed`）
   */
  async setColorPreset(preset: ColorPresetId): Promise<void> {
    await this.ensureInitialized()

    const normalized = normalizeColorPresetId(preset)
    const oldValue = this.state.colorPreset
    this.state.colorPreset = normalized

    try {
      await Promise.all([
        this.setStorageData(STORAGE_KEYS.LOCAL.COLOR_PRESET, normalized, 'local'),
        this.setStorageData(STORAGE_KEYS.SYNC.COLOR_PRESET, normalized, 'sync')
      ])

      logger.info('GlobalStateManager', `配色预设已更新: ${oldValue} -> ${normalized}`)
      emitEvent('colorPreset:changed', { preset: normalized })
    } catch (error) {
      this.state.colorPreset = oldValue
      logger.error('GlobalStateManager', '设置配色预设失败', error)
      throw error
    }
  }

  /**
   * 设置主题 - 支持三种模式：system、light、dark
   */
  async setTheme(theme: ThemeMode): Promise<void> {
    await this.ensureInitialized()

    const oldValue = this.state.theme
    this.state.theme = theme

    try {
      // 同时保存到本地和同步存储
      await Promise.all([
        this.setStorageData(STORAGE_KEYS.LOCAL.THEME, theme, 'local'),
        this.setStorageData(STORAGE_KEYS.SYNC.THEME, theme, 'sync')
      ])

      logger.info('GlobalStateManager', `主题已更新: ${oldValue} -> ${theme}`)
    } catch (error) {
      this.state.theme = oldValue
      logger.error('GlobalStateManager', '设置主题失败', error)
      throw error
    }
  }

  /**
   * 获取是否自动跟随系统主题
   */
  getAutoFollowSystemTheme(): boolean {
    return this.state?.autoFollowSystemTheme ?? DEFAULT_STATE.autoFollowSystemTheme
  }

  /**
   * 获取自动同步设置
   */
  getAutoSync(): boolean {
    return this.state.autoSync
  }

  /**
   * 设置自动同步
   */
  async setAutoSync(autoSync: boolean): Promise<void> {
    await this.ensureInitialized()

    const oldValue = this.state.autoSync
    this.state.autoSync = autoSync

    try {
      await this.setStorageData(STORAGE_KEYS.LOCAL.AUTO_SYNC, autoSync, 'local')
      logger.info('GlobalStateManager', `自动同步已更新: ${oldValue} -> ${autoSync}`)
    } catch (error) {
      this.state.autoSync = oldValue
      logger.error('GlobalStateManager', '设置自动同步失败', error)
      throw error
    }
  }

  /**
   * 获取显示图标设置
   */
  getShowFavicons(): boolean {
    return this.state.showFavicons
  }

  /**
   * 设置显示图标
   */
  async setShowFavicons(showFavicons: boolean): Promise<void> {
    await this.ensureInitialized()

    const oldValue = this.state.showFavicons
    this.state.showFavicons = showFavicons

    try {
      await this.setStorageData(STORAGE_KEYS.LOCAL.SHOW_FAVICONS, showFavicons, 'local')
      logger.info('GlobalStateManager', `显示图标已更新: ${oldValue} -> ${showFavicons}`)
    } catch (error) {
      this.state.showFavicons = oldValue
      logger.error('GlobalStateManager', '设置显示图标失败', error)
      throw error
    }
  }

  /**
   * 获取紧凑模式设置
   */
  getCompactMode(): boolean {
    return this.state.compactMode
  }

  /**
   * 设置紧凑模式
   */
  async setCompactMode(compactMode: boolean): Promise<void> {
    await this.ensureInitialized()

    const oldValue = this.state.compactMode
    this.state.compactMode = compactMode

    try {
      await this.setStorageData(STORAGE_KEYS.LOCAL.COMPACT_MODE, compactMode, 'local')
      logger.info('GlobalStateManager', `紧凑模式已更新: ${oldValue} -> ${compactMode}`)
    } catch (error) {
      this.state.compactMode = oldValue
      logger.error('GlobalStateManager', '设置紧凑模式失败', error)
      throw error
    }
  }

  /**
   * 设置是否自动跟随系统主题
   */
  async setAutoFollowSystemTheme(autoFollow: boolean): Promise<void> {
    await this.ensureInitialized()

    const oldValue = this.state.autoFollowSystemTheme
    this.state.autoFollowSystemTheme = autoFollow

    try {
      await this.setStorageData(STORAGE_KEYS.LOCAL.AUTO_FOLLOW_SYSTEM_THEME, autoFollow, 'local')
      logger.info('GlobalStateManager', `自动跟随系统主题已更新: ${oldValue} -> ${autoFollow}`)
    } catch (error) {
      this.state.autoFollowSystemTheme = oldValue
      logger.error('GlobalStateManager', '设置自动跟随系统主题失败', error)
      throw error
    }
  }

  /**
   * 添加状态变化监听器
   */
  addListener(listener: (state: GlobalState) => void): () => void {
    this.listeners.push(listener)

    // 返回取消监听的函数
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }
}

// ===== 导出单例实例 =====

/**
 * 全局状态管理器单例实例
 */
export const globalStateManager = GlobalStateManager.getInstance()

// ===== 便捷函数 =====

/**
 * 便捷函数 - 获取主题
 */
export async function getTheme(): Promise<ThemeMode> {
  await globalStateManager.initialize()
  return globalStateManager.getTheme()
}

/**
 * 便捷函数 - 设置主题
 */
export async function setTheme(theme: ThemeMode): Promise<void> {
  await globalStateManager.initialize()
  return globalStateManager.setTheme(theme)
}

/**
 * 便捷函数 - 获取配色预设
 */
export async function getColorPreset(): Promise<ColorPresetId> {
  await globalStateManager.initialize()
  return globalStateManager.getColorPreset()
}

/**
 * 便捷函数 - 设置配色预设
 */
export async function setColorPreset(preset: ColorPresetId): Promise<void> {
  await globalStateManager.initialize()
  return globalStateManager.setColorPreset(preset)
}

/**
 * 便捷函数 - 获取是否自动跟随系统主题
 */
export async function getAutoFollowSystemTheme(): Promise<boolean> {
  await globalStateManager.initialize()
  return globalStateManager.getAutoFollowSystemTheme()
}

/**
 * 便捷函数 - 设置是否自动跟随系统主题
 */
export async function setAutoFollowSystemTheme(autoFollow: boolean): Promise<void> {
  await globalStateManager.initialize()
  return globalStateManager.setAutoFollowSystemTheme(autoFollow)
}

/**
 * 便捷函数 - 添加状态监听器
 */
export function addGlobalStateListener(listener: (state: GlobalState) => void): () => void {
  return globalStateManager.addListener(listener)
}
