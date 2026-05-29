/**
 * 国际化服务 - 基础设施层
 *
 * 职责：
 * - 提供 Chrome i18n API 的统一封装
 * - 支持 Vue 指令集成
 * - 处理多语言文本获取和占位符替换
 * - 兼容扩展环境和普通网页环境
 */

import { logger } from "../logging/logger";

/**
 * 国际化配置
 */
export interface I18nConfig {
  fallbackLanguage: string;
  enableVueDirective: boolean;
  debugMode: boolean;
}

/**
 * 占位符替换选项
 */
export interface SubstitutionOptions {
  /** 是否启用占位符替换 */
  enableSubstitution?: boolean;
  /** 自定义占位符格式 */
  placeholderFormat?: string;
}

/**
 * 国际化服务
 */
export class I18nService {
  private config: I18nConfig;
  private vueDirective?: {
    mounted: (el: HTMLElement, binding: { value: string }) => void;
    updated: (el: HTMLElement, binding: { value: string }) => void;
  };

  constructor(config: Partial<I18nConfig> = {}) {
    this.config = {
      fallbackLanguage: "en",
      enableVueDirective: true,
      debugMode: import.meta.env.DEV,
      ...config,
    };

    if (this.config.enableVueDirective) {
      this.setupVueDirective();
    }
  }

  /**
   * 获取国际化文本
   * @param key 消息键
   * @param substitutions 占位符替换值（支持字符串或数组）
   * @param options 替换选项
   */
  t(key: string, substitutions?: string | string[]): string {
    try {
      // Chrome 扩展环境
      if (
        typeof chrome !== "undefined" &&
        chrome.i18n &&
        typeof chrome.i18n.getMessage === "function"
      ) {
        const message = chrome.i18n.getMessage(key, substitutions);

        if (this.config.debugMode) {
          logger.debug("I18nService", "Chrome i18n 获取消息", {
            key,
            substitutions,
            result: message,
          });
        }

        // 如果成功获取到消息，返回结果；否则返回键值（回退）
        return message || key;
      }

      // 非扩展环境回退：直接返回 key
      if (this.config.debugMode) {
        logger.debug("I18nService", "非扩展环境，回退到 key", { key });
      }

      return key;
    } catch (error) {
      logger.error("Component", "I18nService", "国际化文本获取失败", error);
      return key; // 出错时返回原始键值
    }
  }

  /**
   * 设置 Vue 指令
   */
  private setupVueDirective(): void {
    this.vueDirective = {
      mounted: (el: HTMLElement, binding: { value: string }) => {
        try {
          el.textContent = this.t(binding.value);
        } catch (error) {
          logger.error(
            "Component",
            "I18nService",
            "Vue 指令 mounted 失败",
            error,
          );
          el.textContent = binding.value; // 出错时显示原始键值
        }
      },
      updated: (el: HTMLElement, binding: { value: string }) => {
        try {
          el.textContent = this.t(binding.value);
        } catch (error) {
          logger.error(
            "Component",
            "I18nService",
            "Vue 指令 updated 失败",
            error,
          );
          el.textContent = binding.value; // 出错时显示原始键值
        }
      },
    };
  }

  /**
   * 获取 Vue 指令对象
   */
  getVueDirective() {
    return this.vueDirective;
  }

  /**
   * 获取当前语言
   * 使用 Chrome 原生 API，返回浏览器的 UI 语言
   */
  getCurrentLanguage(): string {
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.i18n &&
        typeof chrome.i18n.getUILanguage === "function"
      ) {
        return chrome.i18n.getUILanguage();
      }

      // 浏览器原生语言检测
      return (
        navigator.language ||
        navigator.languages?.[0] ||
        this.config.fallbackLanguage
      );
    } catch (error) {
      logger.error("Component", "I18nService", "获取当前语言失败", error);
      return this.config.fallbackLanguage;
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): readonly string[] {
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.i18n &&
        typeof chrome.i18n.getAcceptLanguages === "function"
      ) {
        // Chrome 扩展 API 获取支持语言（异步）
        // 这里返回同步的结果，实际使用时可能需要异步处理
        return [this.getCurrentLanguage()];
      }

      // 浏览器原生支持语言
      return (
        navigator.languages || [
          navigator.language || this.config.fallbackLanguage,
        ]
      );
    } catch (error) {
      logger.error("Component", "I18nService", "获取支持语言失败", error);
      return [this.config.fallbackLanguage];
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<I18nConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.enableVueDirective && !this.vueDirective) {
      this.setupVueDirective();
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): I18nConfig {
    return { ...this.config };
  }
}

/**
 * 默认国际化服务实例
 */
export const i18nService = new I18nService();

/**
 * 便捷函数 - 获取国际化文本
 * @param key 消息键
 * @param substitutions 占位符替换值（支持字符串或数组）
 */
export function t(key: string, substitutions?: string | string[]): string {
  return i18nService.t(key, substitutions);
}

/**
 * 获取 Vue 指令对象
 */
export function getVueI18nDirective() {
  return i18nService.getVueDirective();
}

/**
 * 获取当前语言
 */
export function getCurrentLanguage(): string {
  return i18nService.getCurrentLanguage();
}
