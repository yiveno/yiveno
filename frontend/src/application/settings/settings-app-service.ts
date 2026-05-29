/**
 * 设置应用服务
 *
 * 职责：
 * - 管理应用的全局设置
 * - 根据数据类型选择合适的存储方式
 * - 提供设置的读取、保存和删除接口
 * - 处理设置的同步和降级
 *
 * 设计：
 * - 小数据配置（token、昵称、开关等）→ chrome.storage.local（快速、同步）
 * - 大量数据（书签等）→ IndexedDB（容量大、支持查询）
 * - 全局状态（主题、语言等）双写到全局状态管理器和 chrome.storage.local
 * - 全局状态优先从内存读取，降级到 chrome.storage.local
 */

import { indexedDBManager } from "@/infrastructure/indexeddb/manager";
import {
  globalStateManager,
  type GlobalState,
} from "@/infrastructure/global-state/global-state-manager";
import { chromeStorage } from "@/infrastructure/storage/chrome-storage";
import { logger } from "@/infrastructure/logging/logger";
import { normalizeColorPresetId } from "@acuity-bookmarks/design-tokens/color-presets";

/**
 * 全局设置键名枚举
 *
 * 定义所有全局设置的标准键名
 */
export const GLOBAL_SETTING_KEYS = {
  /** 主题设置 */
  THEME: "theme",
  /** Material 3 配色预设 */
  COLOR_PRESET: "colorPreset",
  /** 自动同步开关 */
  AUTO_SYNC: "autoSync",
  /** 显示图标开关 */
  SHOW_FAVICONS: "showFavicons",
  /** 紧凑模式开关 */
  COMPACT_MODE: "compactMode",
  /** 筛选引擎选择 */
  /** 自动跟随系统主题开关 */
  AUTO_FOLLOW_SYSTEM_THEME: "autoFollowSystemTheme",
} as const;

/**
 * 小数据配置键名（应该使用 chrome.storage.local）
 *
 * 这些是小数据配置，不需要 IndexedDB 的事务和查询能力
 */
const SMALL_DATA_KEYS = new Set([
  // 认证相关
  "auth.jwt",
  "auth.refresh",
  "user.nickname",
  // 其他小数据配置可以在这里添加
  // 'user.preferences',
  // 'app.config',
]);

/**
 * 设置应用服务类
 */
export class SettingsAppService {
  /**
   * 确保依赖服务已初始化
   *
   * @private
   */
  private async ensureInit() {
    await Promise.all([
      indexedDBManager.initialize(),
      globalStateManager.initialize(),
    ]);
  }

  /**
   * 获取设置值
   *
   * 根据数据类型选择合适的存储方式：
   * - 全局状态：优先从内存读取，降级到 chrome.storage.local
   * - 小数据配置：从 chrome.storage.local 读取
   * - 大量数据：从 IndexedDB 读取
   *
   * @param key - 设置键名
   * @returns 设置值，不存在时返回 null
   */
  async getSetting<T>(key: string): Promise<T | null> {
    await this.ensureInit();

    if (this.isGlobalSetting(key)) {
      return this.getGlobalSetting<T>(key);
    }

    if (this.isSmallDataKey(key)) {
      return this.getSmallDataSetting<T>(key);
    }

    return indexedDBManager.getSetting<T>(key);
  }

  /**
   * 获取全局设置
   */
  private async getGlobalSetting<T>(key: string): Promise<T | null> {
    try {
      const state = globalStateManager.getState();
      if (!state) {
        logger.warn(
          "SettingsAppService",
          "全局状态为空，尝试从 chrome.storage.local 获取",
          {
            key,
          },
        );
        const value = await chromeStorage.getLocal<T>(key);
        return value ?? null;
      }

      return this.getGlobalStateValue<T>(state, key);
    } catch (error) {
      logger.error("SettingsAppService", "从全局状态管理器获取设置失败", {
        key,
        error,
      });
      const value = await chromeStorage.getLocal<T>(key);
      return value ?? null;
    }
  }

  /**
   * 从全局状态获取值
   */
  private getGlobalStateValue<T>(state: GlobalState, key: string): T | null {
    switch (key) {
      case GLOBAL_SETTING_KEYS.THEME:
        return (state.theme ?? null) as T;
      case GLOBAL_SETTING_KEYS.COLOR_PRESET:
        return (state.colorPreset ?? null) as T;
      case GLOBAL_SETTING_KEYS.AUTO_SYNC:
        return (state.autoSync ?? null) as T;
      case GLOBAL_SETTING_KEYS.SHOW_FAVICONS:
        return (state.showFavicons ?? null) as T;
      case GLOBAL_SETTING_KEYS.COMPACT_MODE:
        return (state.compactMode ?? null) as T;
      case GLOBAL_SETTING_KEYS.AUTO_FOLLOW_SYSTEM_THEME:
        return (state.autoFollowSystemTheme ?? null) as T;
      default:
        return null;
    }
  }

  /**
   * 获取小数据配置
   */
  private async getSmallDataSetting<T>(key: string): Promise<T | null> {
    logger.debug("SettingsAppService", `🔍 从小数据配置读取: ${key}`);
    const value = await chromeStorage.getLocal<T>(key);
    logger.debug("SettingsAppService", `📖 读取结果: ${key}`, {
      found: value !== undefined && value !== null,
      valueType: typeof value,
    });
    return value ?? null;
  }

  /**
   * 保存设置
   *
   * 根据数据类型选择合适的存储方式：
   * - 全局状态：同时保存到全局状态管理器和 chrome.storage.local（双写）
   * - 小数据配置：保存到 chrome.storage.local
   * - 大量数据：保存到 IndexedDB
   *
   * @param key - 设置键名
   * @param value - 设置值
   * @param type - 可选的类型标识
   * @param description - 可选的描述信息
   */
  async saveSetting(
    key: string,
    value: unknown,
    type?: string,
    description?: string,
  ): Promise<void> {
    await this.ensureInit();

    try {
      // 全局状态同时保存到全局状态管理器和 chrome.storage.local
      if (this.isGlobalSetting(key)) {
        await this.saveGlobalSetting(key, value);
        // 同时保存到 chrome.storage.local（持久化）
        await chromeStorage.setLocal(key, value);
        logger.info("SettingsAppService", `✅ 全局设置已保存: ${key}`);
        return;
      }

      // 小数据配置保存到 chrome.storage.local
      if (this.isSmallDataKey(key)) {
        logger.info(
          "SettingsAppService",
          `🔐 保存小数据配置到 chrome.storage.local: ${key}`,
          {
            valueType: typeof value,
            valueLength: typeof value === "string" ? value.length : "N/A",
          },
        );
        await chromeStorage.setLocal(key, value);
        logger.info(
          "SettingsAppService",
          `✅ 小数据配置已保存到 chrome.storage.local: ${key}`,
        );

        // 验证保存是否成功
        const verify = await chromeStorage.getLocal(key);
        if (verify === undefined || verify === null) {
          logger.error("SettingsAppService", `❌ 保存后验证失败: ${key}`, {
            saved: verify,
            expected: value,
          });
        } else {
          logger.info("SettingsAppService", `✅ 保存后验证成功: ${key}`);
        }
        return;
      }

      // 大量数据保存到 IndexedDB
      logger.debug(
        "SettingsAppService",
        `✅ 大量数据已保存到 IndexedDB: ${key}`,
      );
      return indexedDBManager.saveSetting(key, value, type, description);
    } catch (error) {
      logger.error("SettingsAppService", `❌ 保存设置失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * 删除设置
   *
   * 根据数据类型从对应的存储中删除
   */
  async deleteSetting(key: string): Promise<void> {
    await this.ensureInit();

    // 全局状态同时从两个地方删除
    if (this.isGlobalSetting(key)) {
      await this.deleteGlobalSetting(key);
      await chromeStorage.removeLocal(key);
      return;
    }

    // 小数据配置从 chrome.storage.local 删除
    if (this.isSmallDataKey(key)) {
      await chromeStorage.removeLocal(key);
      return;
    }

    // 大量数据从 IndexedDB 删除
    return indexedDBManager.deleteSetting(key);
  }

  /**
   * 判断是否为小数据配置
   */
  private isSmallDataKey(key: string): boolean {
    return SMALL_DATA_KEYS.has(key) || this.isGlobalSetting(key);
  }

  /**
   * 判断是否为全局设置
   */
  private isGlobalSetting(
    key: string,
  ): key is (typeof GLOBAL_SETTING_KEYS)[keyof typeof GLOBAL_SETTING_KEYS] {
    return Object.values(GLOBAL_SETTING_KEYS).includes(
      key as (typeof GLOBAL_SETTING_KEYS)[keyof typeof GLOBAL_SETTING_KEYS],
    );
  }

  /**
   * 保存全局设置到全局状态管理器
   */
  private async saveGlobalSetting(key: string, value: unknown): Promise<void> {
    try {
      switch (key) {
        case GLOBAL_SETTING_KEYS.THEME:
          await globalStateManager.setTheme(value as "light" | "dark");
          break;
        case GLOBAL_SETTING_KEYS.COLOR_PRESET:
          await globalStateManager.setColorPreset(
            normalizeColorPresetId(value),
          );
          break;
        case GLOBAL_SETTING_KEYS.AUTO_SYNC:
          await globalStateManager.setAutoSync(value as boolean);
          break;
        case GLOBAL_SETTING_KEYS.SHOW_FAVICONS:
          await globalStateManager.setShowFavicons(value as boolean);
          break;
        case GLOBAL_SETTING_KEYS.COMPACT_MODE:
          await globalStateManager.setCompactMode(value as boolean);
          break;
        case GLOBAL_SETTING_KEYS.AUTO_FOLLOW_SYSTEM_THEME:
          await globalStateManager.setAutoFollowSystemTheme(value as boolean);
          break;
      }
    } catch (error) {
      logger.error("SettingsAppService", `保存全局设置失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * 删除全局设置
   */
  private async deleteGlobalSetting(key: string): Promise<void> {
    // 对于全局设置，删除意味着重置为默认值
    try {
      switch (key) {
        case GLOBAL_SETTING_KEYS.THEME:
          await globalStateManager.setTheme("light"); // 删除主题时重置为明亮主题
          break;
        case GLOBAL_SETTING_KEYS.COLOR_PRESET:
          await globalStateManager.setColorPreset("default");
          break;
        case GLOBAL_SETTING_KEYS.AUTO_SYNC:
          await globalStateManager.setAutoSync(true);
          break;
        case GLOBAL_SETTING_KEYS.SHOW_FAVICONS:
          await globalStateManager.setShowFavicons(true);
          break;
        case GLOBAL_SETTING_KEYS.COMPACT_MODE:
          await globalStateManager.setCompactMode(false);
          break;
        case GLOBAL_SETTING_KEYS.AUTO_FOLLOW_SYSTEM_THEME:
          await globalStateManager.setAutoFollowSystemTheme(false);
          break;
      }
    } catch (error) {
      logger.error("SettingsAppService", `删除全局设置失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * 获取所有全局设置（便捷方法）
   */
  async getGlobalSettings() {
    await this.ensureInit();
    return globalStateManager.getState();
  }

  /**
   * 批量保存全局设置（便捷方法）
   */
  async saveGlobalSettings(settings: Partial<GlobalState>): Promise<void> {
    await this.ensureInit();

    try {
      if (settings.theme !== undefined) {
        await globalStateManager.setTheme(settings.theme);
      }
      if (settings.colorPreset !== undefined) {
        await globalStateManager.setColorPreset(
          normalizeColorPresetId(settings.colorPreset),
        );
      }
      if (settings.autoSync !== undefined) {
        await globalStateManager.setAutoSync(settings.autoSync);
      }
      if (settings.showFavicons !== undefined) {
        await globalStateManager.setShowFavicons(settings.showFavicons);
      }
      if (settings.compactMode !== undefined) {
        await globalStateManager.setCompactMode(settings.compactMode);
      }
    } catch (error) {
      logger.error("SettingsAppService", "批量保存全局设置失败", error);
      throw error;
    }
  }
}

export const settingsAppService = new SettingsAppService();
