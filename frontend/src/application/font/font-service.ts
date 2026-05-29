/**
 * 字体服务 - 应用服务层
 *
 * 职责：
 * - 智能检测文本语言并应用最优字体
 * - 管理字体策略和配置
 * - 提供动态字体应用功能
 * - 支持多语言字体优化
 */

import type { Result } from '../../core/common/result'
import { ok, err } from '../../core/common/result'
import { logger } from '../../infrastructure/logging/logger'
import type { DetectedLanguage, FontStrategy, FontServiceConfig } from '@/types/application/font'

/**
 * Google Fonts 字体映射配置
 */
const GOOGLE_FONTS_MAP: Record<string, { family: string; google: string }> = {
  'zh-CN': { family: 'Noto Sans SC', google: 'Noto+Sans+SC' },
  'zh-TW': { family: 'Noto Sans TC', google: 'Noto+Sans+TC' },
  ja: { family: 'Noto Sans JP', google: 'Noto+Sans+JP' },
  ko: { family: 'Noto Sans KR', google: 'Noto+Sans+KR' },
  ar: { family: 'Noto Sans Arabic', google: 'Noto+Sans+Arabic' },
  default: { family: 'Noto Sans', google: 'Noto+Sans' }
}

export interface LanguageStats {
  detectedLanguage: DetectedLanguage
  recommendedSystemFont: string | undefined
  recommendedContentFont: string | undefined
  textLength: number
  cleanLength: number
}

export interface FontApplicationResult {
  detectedLang: DetectedLanguage
  fontFamily: string
  strategy: FontStrategy
}

/**
 * 字体服务
 */
export class FontService {
  private config: FontServiceConfig
  private strategies: Map<DetectedLanguage, FontStrategy> = new Map()
  private observers: MutationObserver[] = []

  constructor(config: Partial<FontServiceConfig> = {}) {
    this.config = {
      enableAutoDetection: true,
      enableDynamicApplication: true,
      debugMode: import.meta.env.DEV,
      systemUISelectors: [
        '.system-ui',
        '.navigation',
        '.toolbar',
        '.menu',
        '.dialog-header',
        '.button',
        '.form-label',
        '.status-text'
      ],
      userContentSelectors: [
        '.user-content',
        '.bookmark-item',
        '.bookmark-title',
        '.folder-name',
        '.search-results'
      ],
      ...config
    }

    this.initializeFontStrategies()

    if (this.config.enableDynamicApplication) {
      this.setupDynamicFontApplication()
    }
  }

  /**
   * 初始化字体策略
   */
  private initializeFontStrategies(): void {
    // 中文内容优先策略
    this.strategies.set('zh', {
      detected: 'zh',
      systemUI: '"NotoSansSC", "PingFang SC", "Microsoft YaHei", sans-serif',
      userContent:
        '"NotoSansSC", "NotoSansTC", "NotoSansJP", "NotoSansKR", "NotoSans", system-ui, sans-serif'
    })

    this.strategies.set('zh-CN', {
      systemUI: '"NotoSansSC", "PingFang SC", "Microsoft YaHei", sans-serif',
      userContent:
        '"NotoSansSC", "NotoSansTC", "NotoSansJP", "NotoSansKR", "NotoSans", system-ui, sans-serif',
      detected: 'zh-CN'
    })

    this.strategies.set('zh-TW', {
      systemUI: '"NotoSansTC", "PingFang TC", "Microsoft JhengHei", sans-serif',
      userContent:
        '"NotoSansTC", "NotoSansSC", "NotoSansJP", "NotoSansKR", "NotoSans", system-ui, sans-serif',
      detected: 'zh-TW'
    })

    // 日文内容优先策略
    this.strategies.set('ja', {
      systemUI: '"NotoSansJP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
      userContent:
        '"NotoSansJP", "NotoSansSC", "NotoSansTC", "NotoSansKR", "NotoSans", system-ui, sans-serif',
      detected: 'ja'
    })

    // 韩文内容优先策略
    this.strategies.set('ko', {
      systemUI: '"NotoSansKR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
      userContent:
        '"NotoSansKR", "NotoSansJP", "NotoSansSC", "NotoSansTC", "NotoSans", system-ui, sans-serif',
      detected: 'ko'
    })

    // 阿拉伯文内容优先策略
    this.strategies.set('ar', {
      systemUI: '"NotoSansArabic", "Tahoma", "Arial Unicode MS", sans-serif',
      userContent:
        '"NotoSansArabic", "NotoSans", "NotoSansSC", "NotoSansTC", system-ui, sans-serif',
      detected: 'ar'
    })

    // 英文内容优先策略
    this.strategies.set('en', {
      systemUI: '"NotoSans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      userContent:
        '"NotoSans", "NotoSansSC", "NotoSansTC", "NotoSansJP", "NotoSansKR", system-ui, sans-serif',
      detected: 'en'
    })

    // 混合语言内容策略
    this.strategies.set('mixed', {
      systemUI: '"NotoSans", "NotoSansSC", "NotoSansJP", "NotoSansKR", system-ui, sans-serif',
      userContent:
        '"NotoSansSC", "NotoSansTC", "NotoSansJP", "NotoSansKR", "NotoSansArabic", "NotoSans", system-ui, sans-serif',
      detected: 'mixed'
    })

    // 未知语言备选策略
    this.strategies.set('unknown', {
      systemUI: '"NotoSans", system-ui, sans-serif',
      userContent:
        '"NotoSans", "NotoSansSC", "NotoSansTC", "NotoSansJP", "NotoSansKR", "NotoSansArabic", system-ui, sans-serif',
      detected: 'unknown'
    })
  }

  /**
   * 检测文本语言
   */
  detectLanguage(text: string): DetectedLanguage {
    if (!text || text.trim().length === 0) return 'unknown'

    const cleanText = this.cleanText(text)
    if (cleanText.length === 0) return 'en'

    const stats = this.countLanguageChars(cleanText)
    const ratios = this.calculateLanguageRatios(stats)

    return this.determinePrimaryLanguage(ratios, text)
  }

  /**
   * 清理文本，移除标点符号和数字
   */
  private cleanText(text: string): string {
    return text.replace(
      /[^\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0600-\u06ff\u0750-\u077f\u3400-\u4dbf\u0041-\u005A\u0061-\u007A]/g,
      ''
    )
  }

  /**
   * 统计各种语言的字符数
   */
  private countLanguageChars(text: string): {
    chinese: number
    japanese: number
    korean: number
    arabic: number
    latin: number
    total: number
  } {
    const stats = {
      chinese: 0,
      japanese: 0,
      korean: 0,
      arabic: 0,
      latin: 0,
      total: text.length
    }

    for (const char of text) {
      const code = char.charCodeAt(0)

      if (this.isChineseChar(code)) {
        stats.chinese++
      } else if (this.isJapaneseChar(code)) {
        stats.japanese++
      } else if (this.isKoreanChar(code)) {
        stats.korean++
      } else if (this.isArabicChar(code)) {
        stats.arabic++
      } else if (this.isLatinChar(code)) {
        stats.latin++
      }
    }

    return stats
  }

  /**
   * 计算各语言字符比例
   */
  private calculateLanguageRatios(stats: {
    chinese: number
    japanese: number
    korean: number
    arabic: number
    latin: number
    total: number
  }): {
    chinese: number
    japanese: number
    korean: number
    arabic: number
    latin: number
  } {
    return {
      chinese: stats.chinese / stats.total,
      japanese: stats.japanese / stats.total,
      korean: stats.korean / stats.total,
      arabic: stats.arabic / stats.total,
      latin: stats.latin / stats.total
    }
  }

  /**
   * 判断主要语言
   */
  private determinePrimaryLanguage(
    ratios: {
      chinese: number
      japanese: number
      korean: number
      arabic: number
      latin: number
    },
    originalText: string
  ): DetectedLanguage {
    if (ratios.chinese > 0.3) {
      return this.detectChineseVariant(originalText)
    }

    if (ratios.japanese > 0.1 || (ratios.japanese > 0.05 && ratios.chinese > 0.1)) {
      return 'ja'
    }

    if (ratios.korean > 0.3) {
      return 'ko'
    }

    if (ratios.arabic > 0.3) {
      return 'ar'
    }

    if (ratios.latin > 0.7) {
      return 'en'
    }

    const nonLatinTotal = ratios.chinese + ratios.japanese + ratios.korean + ratios.arabic
    if (nonLatinTotal > 0.2 && ratios.latin > 0.2) {
      return 'mixed'
    }

    if (ratios.chinese > 0.1) {
      return this.detectChineseVariant(originalText)
    }

    return 'unknown'
  }

  /**
   * 判断是否为中文字符
   */
  private isChineseChar(code: number): boolean {
    return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)
  }

  /**
   * 判断是否为日文字符
   */
  private isJapaneseChar(code: number): boolean {
    return (code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff)
  }

  /**
   * 判断是否为韩文字符
   */
  private isKoreanChar(code: number): boolean {
    return code >= 0xac00 && code <= 0xd7af
  }

  /**
   * 判断是否为阿拉伯文字符
   */
  private isArabicChar(code: number): boolean {
    return (code >= 0x0600 && code <= 0x06ff) || (code >= 0x0750 && code <= 0x077f)
  }

  /**
   * 判断是否为拉丁字符
   */
  private isLatinChar(code: number): boolean {
    return (code >= 0x0041 && code <= 0x005a) || (code >= 0x0061 && code <= 0x007a)
  }

  /**
   * 检测中文变体 (简体/繁体)
   */
  private detectChineseVariant(text: string): 'zh-CN' | 'zh-TW' {
    // 简化的简繁体检测 - 基于常见字符
    const simplifiedIndicators = ['的', '了', '在', '是', '我', '有', '他', '这', '中', '来']
    const traditionalIndicators = ['的', '了', '在', '是', '我', '有', '他', '這', '中', '來']

    let _simplifiedScore = 0
    let _traditionalScore = 0

    for (const char of simplifiedIndicators) {
      if (text.includes(char)) _simplifiedScore++
    }

    for (const char of traditionalIndicators) {
      if (text.includes(char)) _traditionalScore++
    }

    // 检测繁体特有字符
    const traditionalOnlyChars = /[繁體字線條]/
    if (traditionalOnlyChars.test(text)) {
      return 'zh-TW'
    }

    // 默认简体中文
    return 'zh-CN'
  }

  /**
   * 为元素应用智能字体
   */
  applySmartFont(
    element: HTMLElement,
    isSystemUI: boolean = false
  ): Result<FontApplicationResult, Error> {
    try {
      const text = element.textContent || ''
      const detectedLang = this.detectLanguage(text)
      const strategy = this.strategies.get(detectedLang) || this.strategies.get('unknown')!

      const fontFamily = isSystemUI ? strategy.systemUI : strategy.userContent
      element.style.fontFamily = fontFamily

      // 添加调试信息
      if (this.config.debugMode) {
        element.setAttribute('data-detected-lang', detectedLang)
        element.setAttribute('data-font-strategy', isSystemUI ? 'system' : 'content')
      }

      return ok({ detectedLang, fontFamily, strategy })
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 批量处理页面元素
   */
  processPageElements(): Result<void, Error> {
    // Service Worker 环境检查
    if (typeof document === 'undefined') {
      return ok(undefined)
    }

    try {
      // 处理系统UI元素
      const systemSelector = this.config.systemUISelectors.join(', ')
      const systemElements = document.querySelectorAll(systemSelector)
      systemElements.forEach(element => {
        this.applySmartFont(element as HTMLElement, true)
      })

      // 处理用户内容元素
      const contentSelector = this.config.userContentSelectors.join(', ')
      const contentElements = document.querySelectorAll(contentSelector)
      contentElements.forEach(element => {
        this.applySmartFont(element as HTMLElement, false)
      })

      return ok(undefined)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 设置动态字体应用 - 监听DOM变化
   */
  private setupDynamicFontApplication(): void {
    // Service Worker 环境检查
    if (typeof document === 'undefined') return
    if (!this.config.enableDynamicApplication) return

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as HTMLElement

              // 检查是否为系统UI或用户内容
              const systemSelector = this.config.systemUISelectors.join(', ')
              const contentSelector = this.config.userContentSelectors.join(', ')

              const isSystemUI = element.closest(systemSelector) !== null
              const isUserContent = element.closest(contentSelector) !== null

              if (isSystemUI || isUserContent) {
                this.applySmartFont(element, isSystemUI)
              }

              // 递归处理子元素
              const allSelectors = `${systemSelector}, ${contentSelector}`
              const childElements = element.querySelectorAll(allSelectors)
              childElements.forEach(child => {
                const childIsSystemUI = child.closest(systemSelector) !== null
                this.applySmartFont(child as HTMLElement, childIsSystemUI)
              })
            }
          })
        }
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    this.observers.push(observer)
  }

  /**
   * 手动刷新所有字体
   */
  refreshAllFonts(): Result<void, Error> {
    return this.processPageElements()
  }

  /**
   * 获取语言统计信息
   */
  getLanguageStats(text: string): LanguageStats {
    const detected = this.detectLanguage(text)
    const strategy = this.strategies.get(detected)

    return {
      detectedLanguage: detected,
      recommendedSystemFont: strategy?.systemUI,
      recommendedContentFont: strategy?.userContent,
      textLength: text.length,
      cleanLength: text.replace(
        /[^\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0600-\u06ff\u0750-\u077f\u0041-\u005A\u0061-\u007A]/g,
        ''
      ).length
    }
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<FontServiceConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): FontServiceConfig {
    return { ...this.config }
  }

  /**
   * 获取所有字体策略
   */
  getStrategies(): Map<DetectedLanguage, FontStrategy> {
    return new Map(this.strategies)
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }

  /**
   * 注入动态字体链接
   * 根据 UI 语言选择合适的 Google Fonts 并注入
   */
  injectDynamicFontLink(): Result<void, Error> {
    // Service Worker 环境检查
    if (typeof document === 'undefined') {
      return ok(undefined)
    }

    try {
      const doInject = () => {
        const lang = detectBrowserLanguage()
        logger.info('FontService', '检测到浏览器语言', { lang })

        const font = getFontForLanguage(lang)
        if (!font) {
          return
        }

        injectGoogleFont(font)
        setFontFamilyCSSVariable(font)
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', doInject)
      } else {
        doInject()
      }

      return ok(undefined)
    } catch (error) {
      logger.error('Component', 'FontService', '动态字体注入失败', error)
      return err(error as Error)
    }
  }
}

/**
 * 检测浏览器语言
 */
function detectBrowserLanguage(): string {
  if (
    typeof chrome !== 'undefined' &&
    chrome.i18n &&
    typeof chrome.i18n.getUILanguage === 'function'
  ) {
    return navigator.language
  }
  return navigator.language || navigator.languages?.[0] || 'en'
}

/**
 * 根据语言获取字体配置
 */
function getFontForLanguage(lang: string): { family: string; google: string } | undefined {
  let langKey = 'default'
  if (lang.startsWith('zh-CN') || lang.startsWith('zh-Hans')) langKey = 'zh-CN'
  else if (lang.startsWith('zh-TW') || lang.startsWith('zh-Hant') || lang.startsWith('zh-HK'))
    langKey = 'zh-TW'
  else if (lang.startsWith('ja')) langKey = 'ja'
  else if (lang.startsWith('ko')) langKey = 'ko'
  else if (lang.startsWith('ar')) langKey = 'ar'

  return GOOGLE_FONTS_MAP[langKey] ?? GOOGLE_FONTS_MAP.default
}

/**
 * 注入 Google 字体
 */
function injectGoogleFont(font: { family: string; google: string }): void {
  const href = `https://fonts.googleapis.com/css2?family=${font.google}:wght@100..900&display=swap`

  const old = document.getElementById('dynamic-google-font')
  if (old) old.remove()

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.id = 'dynamic-google-font'
  document.head.appendChild(link)

  logger.info('FontService', '动态字体注入完成', {
    font: font.family,
    href
  })
}

/**
 * 设置字体族 CSS 变量
 */
function setFontFamilyCSSVariable(font: { family: string; google: string }): void {
  document.documentElement.style.setProperty(
    '--font-family-dynamic',
    `"${font.family}", sans-serif`
  )
}

/**
 * 默认字体服务实例
 */
export const fontService = new FontService()

/**
 * 便捷函数（保持向后兼容）
 */
export function detectTextLanguage(text: string): DetectedLanguage {
  return fontService.detectLanguage(text)
}

export function applySmartFontToElement(
  element: HTMLElement,
  isSystemUI: boolean = false
): FontApplicationResult | null {
  const result = fontService.applySmartFont(element, isSystemUI)
  return result.ok ? result.value : null
}

export function initializeSmartFonts(): void {
  // Service Worker 环境检查
  if (typeof document === 'undefined') {
    return
  }

  const processFonts = () => {
    const result = fontService.processPageElements()
    if (result.ok) {
      logger.info('FontService', '智能字体管理器已初始化')
    } else {
      logger.error('Component', 'FontService', '智能字体管理器初始化失败', result.error)
    }
  }

  // 页面加载完成后自动处理
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processFonts, { once: true })
  } else {
    // DOM 已准备好，使用 requestAnimationFrame 确保 DOM 完全渲染
    // 而不是固定延迟
    requestAnimationFrame(() => {
      requestAnimationFrame(processFonts) // 两帧确保渲染完成
    })
  }
}
