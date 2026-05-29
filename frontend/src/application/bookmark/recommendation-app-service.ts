/**
 * 基于Chrome Bookmarks API的智能书签推荐引擎
 *
 * 核心功能：
 * - 基于使用频率的推荐算法
 * - 基于时间模式的智能推荐
 * - 上下文感知的个性化体验
 * - 推荐效果分析和优化
 */

import { logger } from '@/infrastructure/logging/logger'
import { CRAWLER_CONFIG } from '@/config/constants'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'

// 动态导入性能监控
async function getPerformanceMonitor() {
  if (typeof document === 'undefined') {
    return null
  }
  const { getPerformanceMonitor: monitor } = await import('@/services/query-performance-monitor')
  return monitor()
}

function isChromeTabsAvailable(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.tabs !== 'undefined' &&
    typeof chrome.tabs.query === 'function'
  )
}

async function queryActiveTabSafe(): Promise<chrome.tabs.Tab | undefined> {
  if (!isChromeTabsAvailable()) {
    return undefined
  }
  try {
    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })
    return currentTab
  } catch (error) {
    logger.warn('SmartRecommendation', 'chrome.tabs.query 失败', error)
    return undefined
  }
}
// ==================== 类型定义 ====================

// 扩展 BookmarkRecord 类型以包含 Chrome API 特有的属性
type BookmarkWithUsage = BookmarkRecord & {
  dateLastUsed?: number
}

export interface SmartRecommendation {
  // 基础书签信息
  id: string
  title: string
  url: string
  dateAdded?: number | undefined
  dateLastUsed?: number | undefined
  parentId?: string | undefined

  // 推荐相关信息
  recommendationScore: number // 推荐分数 (0-100)
  recommendationReason: RecommendationReason[]
  recommendationType: RecommendationType
  confidence: number // 置信度 (0-1)

  // 使用统计
  visitCount: number
  recentVisitCount: number // 最近访问次数
  lastVisitTime?: number | undefined
  averageVisitInterval?: number | undefined // 平均访问间隔(天)

  // 上下文信息
  contextScore: number // 上下文相关性分数
  timePatternScore: number // 时间模式分数
  frequencyScore: number // 频率分数
  similarityScore: number // 相似度分数

  // 元数据
  domain?: string | undefined
  category?: string | undefined
  tags?: string[] | undefined
  path?: string[] | undefined
}

export type RecommendationType =
  | 'frequent' // 高频使用
  | 'recent' // 最近访问
  | 'similar' // 相似内容
  | 'contextual' // 上下文相关
  | 'temporal' // 时间模式
  | 'trending' // 趋势推荐
  | 'seasonal' // 季节性推荐

export interface RecommendationReason {
  type: RecommendationType
  description: string
  weight: number // 权重 (0-1)
  evidence: string[] // 推荐依据
}

export interface RecommendationContext {
  currentTime: number
  currentHour: number
  currentDayOfWeek: number
  currentUrl?: string | undefined
  currentDomain?: string | undefined
  currentPageTitle?: string | undefined
  recentSearches: string[]
  recentBookmarks: string[]
  userBehaviorPattern: UserBehaviorPattern
}

export interface UserBehaviorPattern {
  // 时间偏好
  activeHours: number[] // 活跃时间段
  activeDays: number[] // 活跃日期
  peakUsageTime: number // 使用高峰时间

  // 使用习惯
  averageSessionDuration: number // 平均会话时长(分钟)
  bookmarkingFrequency: number // 书签添加频率(每天)
  searchFrequency: number // 筛选频率(每天)

  // 内容偏好
  preferredDomains: DomainPreference[]
  preferredCategories: string[]
  commonKeywords: string[]

  // 行为模式
  browsingStyle: 'sequential' | 'random' | 'goal-oriented'
  discoverability: 'high' | 'medium' | 'low' // 发现新内容的倾向
}

export interface DomainPreference {
  domain: string
  visitCount: number
  averageStayTime: number
  lastVisit: number
  preference: number // 偏好度 (0-1)
}

export interface RecommendationStats {
  totalRecommendations: number
  acceptedRecommendations: number
  rejectedRecommendations: number
  clickThroughRate: number
  averageConfidence: number
  topRecommendationTypes: { [type: string]: number }
  performanceMetrics: {
    generationTime: number
    accuracy: number
    diversity: number
    novelty: number
  }
}

export interface RecommendationOptions {
  maxResults?: number | undefined // 最大推荐数量，默认10
  minConfidence?: number | undefined // 最低置信度，默认0.3
  includeRecentOnly?: boolean | undefined // 是否只包含最近访问，默认false
  contextWeight?: number | undefined // 上下文权重，默认0.3
  diversityFactor?: number | undefined // 多样性因子，默认0.2
  excludeTypes?: RecommendationType[] | undefined // 排除的推荐类型
  userContext?: Partial<RecommendationContext> | undefined // 用户上下文
}

// ==================== 智能推荐引擎主类 ====================

export class SmartRecommendationEngine {
  private userBehaviorPattern: UserBehaviorPattern | null = null
  private recommendationHistory = new Map<string, SmartRecommendation[]>()
  private performanceStats: RecommendationStats
  private performanceMonitor: Awaited<ReturnType<typeof getPerformanceMonitor>> | null = null
  // private performanceOptimizer = getPerformanceOptimizer() // 暂时注释，Phase 2 Step 3 相关

  // 推荐算法配置
  private readonly config = {
    // 分数权重
    frequencyWeight: 0.3, // 频率权重
    recencyWeight: 0.25, // 最近性权重
    contextWeight: 0.2, // 上下文权重
    similarityWeight: 0.15, // 相似度权重
    timePatternWeight: 0.1, // 时间模式权重

    // 时间衰减
    timeDecayHalfLife: 7, // 时间衰减半衰期(天)
    recentThreshold: 7 * 24 * 60 * 60 * 1000, // 最近阈值(7天)

    // 推荐质量
    minScore: 10, // 最低推荐分数
    maxRecommendations: 50, // 最大推荐数
    diversityThreshold: 0.7, // 多样性阈值

    // 缓存配置
    cacheTimeout: 15 * 60 * 1000, // 缓存15分钟
    behaviorAnalysisInterval: 24 * 60 * 60 * 1000 // 行为分析间隔(24小时)
  }

  constructor() {
    this.performanceStats = this.initializeStats()
    this.initializeEngine()
  }

  /**
   * 初始化推荐引擎
   */
  private async initializeEngine(): Promise<void> {
    try {
      logger.info('SmartRecommendation', '初始化智能推荐引擎...')

      // 初始化性能监控
      this.performanceMonitor = await getPerformanceMonitor()

      // 分析用户行为模式
      await this.analyzeUserBehaviorPattern()

      logger.info('SmartRecommendation', '智能推荐引擎初始化完成')
    } catch (error) {
      logger.error('Component', 'SmartRecommendation', '初始化失败', error)
    }
  }

  async generateRecommendations(
    options: RecommendationOptions = {}
  ): Promise<SmartRecommendation[]> {
    const startTime = performance.now()

    try {
      logger.info('SmartRecommendation', '开始生成智能推荐...')

      // 解析选项
      const {
        maxResults = 10,
        minConfidence = 0.3,
        includeRecentOnly = false,
        // contextWeight = 0.3, // TODO: 后续版本使用
        diversityFactor = 0.2,
        excludeTypes = [],
        userContext
      } = options

      // 构建推荐上下文
      const context = await this.buildRecommendationContext(userContext)

      // 获取候选书签
      const candidates = await this.getCandidateBookmarks(includeRecentOnly)
      logger.info('SmartRecommendation', `📚 获取到${candidates.length}个候选书签`)

      // 🚀 轻量级爬虫增强书签数据 (智能全量爬取策略)
      // ⚠️ 已禁用自动爬取，避免内存泄漏和浏览器卡死
      // 用户可在设置页面手动启动爬取任务
      // this.smartEnhanceAllBookmarks(candidates) // 智能增强所有候选书签

      // 并行计算各种推荐分数
      const scoringPromises = candidates.map(bookmark =>
        this.calculateRecommendationScore(bookmark, context)
      )
      const scoredBookmarks = await Promise.all(scoringPromises)

      // ✅ 修复：添加URL去重逻辑
      const uniqueUrls = new Set<string>()
      const filteredBookmarks = scoredBookmarks
        .filter(bookmark => bookmark.confidence >= minConfidence)
        .filter(bookmark => !excludeTypes.includes(bookmark.recommendationType))
        .filter(bookmark => {
          // URL去重：如果URL已存在，跳过
          if (uniqueUrls.has(bookmark.url)) {
            logger.debug('SmartRecommendation', `🔄 跳过重复URL: ${bookmark.url}`)
            return false
          }
          uniqueUrls.add(bookmark.url)
          return true
        })
        .sort((a, b) => b.recommendationScore - a.recommendationScore)

      // 应用多样性过滤
      const diverseRecommendations = this.applyDiversityFilter(filteredBookmarks, diversityFactor)

      // 限制结果数量
      const finalRecommendations = diverseRecommendations.slice(0, maxResults)

      // 记录性能统计
      const duration = performance.now() - startTime
      this.updatePerformanceStats(finalRecommendations, duration)

      logger.info(
        'SmartRecommendation',
        `推荐生成完成: ${finalRecommendations.length}个推荐, 耗时${duration.toFixed(2)}ms`
      )

      // ✅ 调试信息：显示推荐详情
      finalRecommendations.forEach((rec, index) => {
        logger.info('SmartRecommendation', `${index + 1}. ${rec.title}`)
        logger.info(
          'SmartRecommendation',
          `评分: ${rec.recommendationScore.toFixed(1)} | 置信度: ${(rec.confidence * 100).toFixed(1)}%`
        )
        logger.info('SmartRecommendation', `类型: ${rec.recommendationType} | 域名: ${rec.domain}`)
        logger.info(
          'SmartRecommendation',
          `分维度分数: 频率${rec.frequencyScore.toFixed(1)} 最近${rec.timePatternScore.toFixed(1)} 上下文${rec.contextScore.toFixed(1)}`
        )
        logger.info(
          'SmartRecommendation',
          `推荐原因: ${rec.recommendationReason.map(r => r.description).join(', ')}`
        )
        logger.info('SmartRecommendation', `URL: ${rec.url}`)
      })

      return finalRecommendations
    } catch (error) {
      logger.error('Component', 'SmartRecommendation', '推荐生成失败', error)
      return []
    }
  }

  /**
   * 构建推荐上下文 - ✅ 增强当前页面感知
   */
  private async buildRecommendationContext(
    userContext?: Partial<RecommendationContext>
  ): Promise<RecommendationContext> {
    const now = new Date()

    // 基础时间上下文
    const baseContext: RecommendationContext = {
      currentTime: Date.now(),
      currentHour: now.getHours(),
      currentDayOfWeek: now.getDay(),
      recentSearches: [],
      recentBookmarks: [],
      userBehaviorPattern: this.userBehaviorPattern || (await this.analyzeUserBehaviorPattern())
    }

    // ✅ 获取当前活动标签页信息
    const currentTab = await queryActiveTabSafe()
    if (currentTab?.url && !currentTab.url.startsWith('chrome://')) {
      baseContext.currentUrl = currentTab.url
      baseContext.currentDomain = this.extractDomain(currentTab.url)

      if (currentTab.title) {
        baseContext.currentPageTitle = currentTab.title
      }

      logger.info(
        'SmartRecommendation',
        `当前浏览: ${baseContext.currentDomain} - ${currentTab.title?.substring(0, 50)}...`
      )
    }

    // 获取最近筛选历史（如果可用）
    try {
      // 从性能监控中获取最近的筛选
      if (this.performanceMonitor) {
        const performanceData = this.performanceMonitor.exportPerformanceData()
        baseContext.recentSearches = performanceData.rawMetrics
          .filter(m => m.timestamp > Date.now() - 24 * 60 * 60 * 1000) // 最近24小时
          .map(m => m.query)
          .slice(0, 10)
      }
    } catch (error) {
      logger.warn('SmartRecommendation', '无法获取筛选历史', error)
    }

    // 获取最近添加的书签
    try {
      const recentBookmarks = await this.getRecentBookmarks(7) // 最近7天
      baseContext.recentBookmarks = recentBookmarks.map(b => b.id)
    } catch (error) {
      logger.warn('SmartRecommendation', '无法获取最近书签', error)
    }

    // 合并用户提供的上下文
    return { ...baseContext, ...userContext }
  }

  /**
   * 获取候选书签
   * ✅ 符合单向数据流：从 IndexedDB 读取
   */
  private async getCandidateBookmarks(recentOnly: boolean = false): Promise<BookmarkRecord[]> {
    try {
      // ✅ 确保 IndexedDB 已初始化
      await indexedDBManager.initialize()

      // ✅ 从 IndexedDB 获取所有书签
      const allBookmarks = await indexedDBManager.getAllBookmarks()

      // 只保留有URL的书签
      let candidates = allBookmarks.filter(bookmark => bookmark.url)

      // 如果只要最近的，按时间过滤
      if (recentOnly) {
        const recentThreshold = Date.now() - this.config.recentThreshold
        candidates = candidates.filter(
          bookmark =>
            ((bookmark as BookmarkWithUsage).dateLastUsed &&
              (bookmark as BookmarkWithUsage).dateLastUsed! > recentThreshold) ||
            (bookmark.dateAdded && bookmark.dateAdded > recentThreshold)
        )
      }

      return candidates
    } catch (error) {
      logger.error('Component', 'SmartRecommendation', '❌ 获取候选书签失败', error)
      return []
    }
  }

  /**
   * 计算书签推荐分数
   */
  private async calculateRecommendationScore(
    bookmark: BookmarkRecord,
    context: RecommendationContext
  ): Promise<SmartRecommendation> {
    // 计算各个维度的分数
    const frequencyScore = this.calculateFrequencyScore(bookmark, context)
    const recencyScore = this.calculateRecencyScore(bookmark, context)
    const contextScore = this.calculateContextualScore(bookmark, context)
    const similarityScore = this.calculateSimilarityScore(bookmark, context)
    const timePatternScore = this.calculateTimePatternScore(bookmark, context)

    // 加权综合分数
    const recommendationScore = Math.min(
      100,
      Math.max(
        0,
        frequencyScore * this.config.frequencyWeight +
          recencyScore * this.config.recencyWeight +
          contextScore * this.config.contextWeight +
          similarityScore * this.config.similarityWeight +
          timePatternScore * this.config.timePatternWeight
      )
    )

    // 确定推荐类型和原因
    const { recommendationType, reasons } = this.determineRecommendationType(
      frequencyScore,
      recencyScore,
      contextScore,
      similarityScore,
      timePatternScore
    )

    // 计算置信度
    const confidence = this.calculateConfidence(recommendationScore, reasons)

    // 提取元数据
    const domain = this.extractDomain(bookmark.url || '')
    const path = await this.getBookmarkPath(bookmark.id)

    const bookmarkWithUsage = bookmark as BookmarkWithUsage
    return {
      id: bookmark.id,
      title: bookmark.title || '',
      url: bookmark.url || '',
      dateAdded: bookmark.dateAdded,
      dateLastUsed: bookmarkWithUsage.dateLastUsed,
      parentId: bookmark.parentId,

      recommendationScore,
      recommendationReason: reasons,
      recommendationType,
      confidence,

      visitCount: this.estimateVisitCount(bookmark),
      recentVisitCount: this.calculateRecentVisitCount(bookmark),
      lastVisitTime: bookmarkWithUsage.dateLastUsed,
      averageVisitInterval: this.calculateAverageVisitInterval(bookmark),

      contextScore,
      timePatternScore,
      frequencyScore,
      similarityScore,

      domain,
      path,
      tags: [] // TODO: 从用户数据中获取标签
    }
  }

  /**
   * 计算频率分数 - ✅ 改进：减少对Chrome API时间戳的依赖
   */
  private calculateFrequencyScore(
    bookmark: BookmarkRecord,
    _context: RecommendationContext
  ): number {
    let score = 0

    // ✅ 改进1：基于URL特征的流行度评估
    const url = bookmark.url || ''
    const domain = this.extractDomain(url)

    // 流行域名加分
    const popularDomains = [
      'github.com',
      'stackoverflow.com',
      'medium.com',
      'dev.to',
      'google.com',
      'youtube.com',
      'twitter.com',
      'linkedin.com',
      'reddit.com',
      'news.ycombinator.com',
      'zhihu.com',
      'juejin.cn'
    ]
    if (domain && popularDomains.includes(domain)) {
      score += 25
    }

    // ✅ 改进2：基于书签添加时间的新鲜度
    if (bookmark.dateAdded) {
      const daysSinceAdded = (Date.now() - bookmark.dateAdded) / (1000 * 60 * 60 * 24)
      if (daysSinceAdded <= 7)
        score += 30 // 一周内添加
      else if (daysSinceAdded <= 30)
        score += 20 // 一月内添加
      else if (daysSinceAdded <= 90) score += 10 // 三月内添加
    }

    // ✅ 改进3：基于标题和URL的价值评估
    const text = `${bookmark.title || ''} ${url}`.toLowerCase()
    const valueKeywords = [
      'tutorial',
      'guide',
      'docs',
      'documentation',
      'api',
      'reference',
      '教程',
      '指南',
      '文档',
      'awesome',
      'best',
      'top',
      '最佳',
      '精选'
    ]
    for (const keyword of valueKeywords) {
      if (text.includes(keyword)) {
        score += 15
        break // 只加一次分
      }
    }

    // ✅ 传统方式：基于Chrome API时间戳（如果可用）
    const bookmarkWithUsage = bookmark as BookmarkWithUsage
    if (bookmarkWithUsage.dateLastUsed && bookmark.dateAdded) {
      const daysSinceUsed = (Date.now() - bookmarkWithUsage.dateLastUsed) / (1000 * 60 * 60 * 24)
      if (daysSinceUsed <= 7) score += 20
      else if (daysSinceUsed <= 30) score += 10
    }

    return Math.min(100, score)
  }

  /**
   * 计算最近性分数
   */
  private calculateRecencyScore(bookmark: BookmarkRecord, _context: RecommendationContext): number {
    const bookmarkWithUsage = bookmark as BookmarkWithUsage
    const lastUsed = bookmarkWithUsage.dateLastUsed || bookmark.dateAdded
    if (!lastUsed) return 0

    const daysSinceUsed = (Date.now() - lastUsed) / (1000 * 60 * 60 * 24)

    // 时间衰减函数：score = 100 * 2^(-days/halfLife)
    return 100 * Math.pow(2, -daysSinceUsed / this.config.timeDecayHalfLife)
  }

  /**
   * 计算上下文相关性分数 - ✅ 基于当前浏览页面的智能推荐
   */
  private calculateContextualScore(
    bookmark: BookmarkRecord,
    _context: RecommendationContext
  ): number {
    const bookmarkDomain = this.extractDomain(bookmark.url || '')
    const bookmarkUrl = bookmark.url || ''
    const bookmarkTitle = bookmark.title || ''

    let score = 0
    score += this.calculateDomainScore(bookmarkDomain || '', _context)
    score += this.calculatePageTypeScore(bookmarkDomain || '', bookmarkUrl, bookmarkTitle, _context)
    score += this.calculateRelatedDomainScore(bookmarkDomain || '', _context)
    score += this.calculateTitleScore(_context.currentPageTitle || '', bookmarkTitle)
    score += this.calculatePathScore(bookmarkDomain || '', bookmarkUrl, _context)
    score += this.calculateSearchHistoryScore(
      bookmarkTitle,
      bookmarkUrl,
      bookmarkDomain || '',
      _context
    )
    score += this.calculateUserPreferenceScore(bookmarkDomain || '', _context)
    score += this.calculateTimeScore(_context)

    return Math.min(100, score)
  }

  /**
   * 计算域名分数
   */
  private calculateDomainScore(bookmarkDomain: string, _context: RecommendationContext): number {
    if (_context.currentDomain && bookmarkDomain === _context.currentDomain) {
      logger.debug('ContextScore', `🎯 同域名匹配: ${bookmarkDomain} (+60)`)
      return 60
    }
    return 0
  }

  /**
   * 计算页面类型分数
   */
  private calculatePageTypeScore(
    bookmarkDomain: string,
    bookmarkUrl: string,
    bookmarkTitle: string,
    _context: RecommendationContext
  ): number {
    const currentPageType = this.detectPageType(
      _context.currentDomain || '',
      _context.currentUrl || '',
      _context.currentPageTitle || ''
    )
    const bookmarkPageType = this.detectPageType(bookmarkDomain || '', bookmarkUrl, bookmarkTitle)

    if (currentPageType && bookmarkPageType === currentPageType) {
      logger.debug('ContextScore', `🎯 页面类型匹配: ${currentPageType} (+50)`)
      return 50
    }
    return 0
  }

  /**
   * 计算相关域名分数
   */
  private calculateRelatedDomainScore(
    bookmarkDomain: string,
    _context: RecommendationContext
  ): number {
    const currentPageType = this.detectPageType(
      _context.currentDomain || '',
      _context.currentUrl || '',
      _context.currentPageTitle || ''
    )
    const contentRelatedDomains = this.getContentRelatedDomains(currentPageType)
    if (bookmarkDomain && contentRelatedDomains.includes(bookmarkDomain)) {
      logger.debug('ContextScore', `🎯 内容相关域名: ${bookmarkDomain} (+35)`)
      return 35
    }
    return 0
  }

  /**
   * 计算标题分数
   */
  private calculateTitleScore(currentPageTitle: string, bookmarkTitle: string): number {
    const titleMatchScore = this.calculateTitleContentMatch(currentPageTitle, bookmarkTitle)
    if (titleMatchScore > 0) {
      logger.debug('ContextScore', `🎯 标题内容匹配: ${titleMatchScore}`)
      return titleMatchScore
    }
    return 0
  }

  /**
   * 计算路径分数
   */
  private calculatePathScore(
    bookmarkDomain: string,
    bookmarkUrl: string,
    _context: RecommendationContext
  ): number {
    if (_context.currentDomain && bookmarkDomain === _context.currentDomain) {
      const pathSimilarity = this.calculatePathSimilarity(_context.currentUrl || '', bookmarkUrl)
      if (pathSimilarity > 0) {
        logger.debug('ContextScore', `🎯 路径相似性: ${pathSimilarity}`)
      }
      return pathSimilarity
    }
    return 0
  }

  /**
   * 计算搜索历史分数
   */
  private calculateSearchHistoryScore(
    bookmarkTitle: string,
    bookmarkUrl: string,
    bookmarkDomain: string,
    _context: RecommendationContext
  ): number {
    const bookmarkText = `${bookmarkTitle} ${bookmarkUrl}`.toLowerCase()
    let score = 0
    for (const search of _context.recentSearches) {
      const searchLower = search.toLowerCase()
      if (
        bookmarkText.includes(searchLower) ||
        (bookmarkDomain && searchLower.includes(bookmarkDomain))
      ) {
        score += 15
      }
    }
    return score
  }

  /**
   * 计算用户偏好分数
   */
  private calculateUserPreferenceScore(
    bookmarkDomain: string,
    _context: RecommendationContext
  ): number {
    const userPrefs = _context.userBehaviorPattern.preferredDomains
    const domainPref = userPrefs.find(pref => pref.domain === bookmarkDomain)
    if (domainPref) {
      return domainPref.preference * 8
    }
    return 0
  }

  /**
   * 计算时间分数
   */
  private calculateTimeScore(_context: RecommendationContext): number {
    const activeHours = _context.userBehaviorPattern.activeHours
    if (activeHours.includes(_context.currentHour)) {
      return 5
    }
    return 0
  }

  /**
   * 检测页面类型 - ✅ 新增智能页面类型识别
   */
  private detectPageType(domain: string, url: string, title: string): string | null {
    if (!domain) return null

    const content = `${domain} ${url} ${title}`.toLowerCase()

    return (
      this.detectVideoType(domain, content) ||
      this.detectMusicType(domain, content) ||
      this.detectSocialType(domain, content) ||
      this.detectEducationType(domain, content) ||
      this.detectTechType(domain, content) ||
      this.detectNewsType(domain, content) ||
      this.detectShoppingType(domain, content) ||
      null
    )
  }

  /**
   * 检测视频娱乐类
   */
  private detectVideoType(domain: string, content: string): string | null {
    const videoDomains = ['youtube.com', 'bilibili.com', 'vimeo.com', 'twitch.tv']
    const videoKeywords = ['video', 'watch', '播放', '直播', 'live']

    if (videoDomains.includes(domain) || videoKeywords.some(k => content.includes(k))) {
      return 'video'
    }
    return null
  }

  /**
   * 检测音乐类
   */
  private detectMusicType(domain: string, content: string): string | null {
    const musicDomains = ['spotify.com', 'music.apple.com', 'soundcloud.com', 'netease.com']
    const musicKeywords = ['music', 'song', '音乐', '歌曲', '播放列表']

    if (musicDomains.includes(domain) || musicKeywords.some(k => content.includes(k))) {
      return 'music'
    }
    return null
  }

  /**
   * 检测社交媒体类
   */
  private detectSocialType(domain: string, content: string): string | null {
    const socialDomains = [
      'twitter.com',
      'facebook.com',
      'instagram.com',
      'linkedin.com',
      'weibo.com'
    ]
    const socialKeywords = ['social', 'profile', 'follow']

    if (socialDomains.includes(domain) || socialKeywords.some(k => content.includes(k))) {
      return 'social'
    }
    return null
  }

  /**
   * 检测学习教育类
   */
  private detectEducationType(domain: string, content: string): string | null {
    const educationDomains = [
      'coursera.org',
      'udemy.com',
      'edx.org',
      'khan.academy.org',
      'duolingo.com'
    ]
    const educationKeywords = ['course', 'learn', 'education', 'tutorial', '课程', '学习']

    if (educationDomains.includes(domain) || educationKeywords.some(k => content.includes(k))) {
      return 'education'
    }
    return null
  }

  /**
   * 检测技术开发类
   */
  private detectTechType(domain: string, content: string): string | null {
    const techDomains = ['github.com', 'stackoverflow.com', 'developer.mozilla.org']
    const techPatterns = ['docs.', 'api.']
    const techKeywords = ['docs', 'api', 'developer', 'programming', 'code']

    if (
      techDomains.includes(domain) ||
      techPatterns.some(p => domain.includes(p)) ||
      techKeywords.some(k => content.includes(k))
    ) {
      return 'tech'
    }
    return null
  }

  /**
   * 检测新闻资讯类
   */
  private detectNewsType(domain: string, content: string): string | null {
    const newsPatterns = ['news.', 'bbc.com', 'cnn.com', 'reuters.com', 'xinhua.net']
    const newsKeywords = ['news', 'article', '新闻', '资讯']

    if (newsPatterns.some(p => domain.includes(p)) || newsKeywords.some(k => content.includes(k))) {
      return 'news'
    }
    return null
  }

  /**
   * 检测购物类
   */
  private detectShoppingType(domain: string, content: string): string | null {
    const shoppingPatterns = ['amazon.com', 'taobao.com', 'jd.com', 'ebay.com', 'shop']
    const shoppingKeywords = ['shop', 'buy', 'product', '购买', '商品']

    if (
      shoppingPatterns.some(p => domain.includes(p)) ||
      shoppingKeywords.some(k => content.includes(k))
    ) {
      return 'shopping'
    }
    return null
  }

  /**
   * 获取内容相关域名 - ✅ 新增基于内容类型的域名关联
   */
  private getContentRelatedDomains(pageType: string | null): string[] {
    if (!pageType) return []

    const relatedDomains: { [key: string]: string[] } = {
      video: [
        'youtube.com',
        'bilibili.com',
        'vimeo.com',
        'twitch.tv',
        'netflix.com',
        'youku.com',
        'iqiyi.com',
        'tencent.com',
        'douyin.com',
        'kuaishou.com'
      ],
      music: [
        'spotify.com',
        'music.apple.com',
        'soundcloud.com',
        'bandcamp.com',
        'music.163.com',
        'qq.com',
        'kugou.com',
        'xiami.com'
      ],
      social: [
        'twitter.com',
        'facebook.com',
        'instagram.com',
        'linkedin.com',
        'weibo.com',
        'zhihu.com',
        'douban.com',
        'xiaohongshu.com'
      ],
      education: [
        'coursera.org',
        'udemy.com',
        'edx.org',
        'khan.academy.org',
        'duolingo.com',
        'imooc.com',
        'xuetangx.com',
        'icourse163.org',
        'study.163.com'
      ],
      tech: [
        'github.com',
        'stackoverflow.com',
        'medium.com',
        'dev.to',
        'hackernews.com',
        'juejin.cn',
        'csdn.net',
        'cnblogs.com',
        'segmentfault.com',
        'v2ex.com'
      ],
      news: [
        'news.google.com',
        'bbc.com',
        'cnn.com',
        'reuters.com',
        'xinhua.net',
        '163.com',
        'sina.com.cn',
        'sohu.com',
        'ifeng.com'
      ],
      shopping: [
        'amazon.com',
        'ebay.com',
        'alibaba.com',
        'taobao.com',
        'jd.com',
        'tmall.com',
        'pinduoduo.com',
        'shopify.com',
        'etsy.com'
      ]
    }

    return relatedDomains[pageType] || []
  }

  /**
   * 计算标题内容匹配度 - ✅ 新增基于内容的智能匹配
   */
  private calculateTitleContentMatch(currentTitle: string, bookmarkTitle: string): number {
    if (!currentTitle || !bookmarkTitle) return 0

    const currentWords = currentTitle
      .toLowerCase()
      .split(/[^\w\u4e00-\u9fff]+/)
      .filter(w => w.length > 2)
    const bookmarkWords = bookmarkTitle
      .toLowerCase()
      .split(/[^\w\u4e00-\u9fff]+/)
      .filter(w => w.length > 2)

    let matchScore = 0

    for (const currentWord of currentWords) {
      for (const bookmarkWord of bookmarkWords) {
        // 精确匹配
        if (currentWord === bookmarkWord) {
          matchScore += 20
        }
        // 包含匹配
        else if (currentWord.includes(bookmarkWord) || bookmarkWord.includes(currentWord)) {
          matchScore += 10
        }
      }
    }

    return Math.min(40, matchScore) // 限制最高40分
  }

  /**
   * 计算URL路径相似性 - ✅ 新增同域名下的路径相似度
   */
  private calculatePathSimilarity(currentUrl: string, bookmarkUrl: string): number {
    try {
      const currentPath = new URL(currentUrl).pathname
      const bookmarkPath = new URL(bookmarkUrl).pathname

      if (currentPath === bookmarkPath) return 25

      const currentSegments = currentPath.split('/').filter(s => s)
      const bookmarkSegments = bookmarkPath.split('/').filter(s => s)

      let matchingSegments = 0
      const maxSegments = Math.max(currentSegments.length, bookmarkSegments.length)

      for (let i = 0; i < Math.min(currentSegments.length, bookmarkSegments.length); i++) {
        if (currentSegments[i] === bookmarkSegments[i]) {
          matchingSegments++
        }
      }

      return matchingSegments > 0 ? Math.floor((matchingSegments / maxSegments) * 20) : 0
    } catch {
      return 0
    }
  }

  /**
   * 计算相似度分数
   */
  private calculateSimilarityScore(
    bookmark: BookmarkRecord,
    _context: RecommendationContext
  ): number {
    let score = 0

    // 与最近书签的相似度
    for (const recentId of _context.recentBookmarks.slice(0, 5)) {
      // 简化的相似度计算（实际应该使用更复杂的算法）
      if (bookmark.parentId === recentId) {
        score += 20 // 同一文件夹
      }
    }

    // 关键词相似度
    const bookmarkText = `${bookmark.title} ${bookmark.url}`.toLowerCase()
    for (const keyword of _context.userBehaviorPattern.commonKeywords) {
      if (bookmarkText.includes(keyword.toLowerCase())) {
        score += 15
      }
    }

    return Math.min(100, score)
  }

  /**
   * 计算时间模式分数
   */
  private calculateTimePatternScore(
    bookmark: BookmarkRecord,
    context: RecommendationContext
  ): number {
    let score = 0

    // 基于用户活跃时间的分数
    if (context.userBehaviorPattern.activeHours.includes(context.currentHour)) {
      score += 40
    }

    // 基于活跃日期的分数
    if (context.userBehaviorPattern.activeDays.includes(context.currentDayOfWeek)) {
      score += 30
    }

    // 季节性模式（简化版）
    const month = new Date().getMonth()
    const bookmarkMonth = bookmark.dateAdded ? new Date(bookmark.dateAdded).getMonth() : month
    if (Math.abs(month - bookmarkMonth) <= 1) {
      score += 30 // 相近月份
    }

    return Math.min(100, score)
  }

  /**
   * 确定推荐类型和原因
   */
  private determineRecommendationType(
    frequencyScore: number,
    recencyScore: number,
    contextScore: number,
    similarityScore: number,
    timePatternScore: number
  ): {
    recommendationType: RecommendationType
    reasons: RecommendationReason[]
  } {
    const scores = {
      frequent: frequencyScore,
      recent: recencyScore,
      contextual: contextScore,
      similar: similarityScore,
      temporal: timePatternScore
    }

    // 找到最高分数的类型
    const maxScore = Math.max(...Object.values(scores))
    const primaryType = Object.keys(scores).find(
      key => scores[key as keyof typeof scores] === maxScore
    ) as RecommendationType

    // 生成推荐原因
    const reasons: RecommendationReason[] = []

    if (frequencyScore > 50) {
      reasons.push({
        type: 'frequent',
        description: '您经常访问这个网站',
        weight: frequencyScore / 100,
        evidence: ['高频访问记录', '持续使用模式']
      })
    }

    if (recencyScore > 40) {
      reasons.push({
        type: 'recent',
        description: '最近访问过相关内容',
        weight: recencyScore / 100,
        evidence: ['近期访问记录', '活跃使用状态']
      })
    }

    if (contextScore > 30) {
      reasons.push({
        type: 'contextual',
        description: '与当前浏览内容相关',
        weight: contextScore / 100,
        evidence: ['上下文匹配', '使用场景相关']
      })
    }

    if (similarityScore > 25) {
      reasons.push({
        type: 'similar',
        description: '与您的兴趣相似',
        weight: similarityScore / 100,
        evidence: ['内容相似性', '兴趣匹配度']
      })
    }

    if (timePatternScore > 35) {
      reasons.push({
        type: 'temporal',
        description: '符合您的使用时间习惯',
        weight: timePatternScore / 100,
        evidence: ['时间模式匹配', '使用习惯分析']
      })
    }

    return { recommendationType: primaryType || 'contextual', reasons }
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(score: number, reasons: RecommendationReason[]): number {
    // 基础置信度基于分数
    let confidence = Math.min(1, score / 100)

    // 推荐原因越多，置信度越高
    const reasonBonus = Math.min(0.3, reasons.length * 0.1)
    confidence += reasonBonus

    // 权重分布均匀时置信度更高
    if (reasons.length > 1) {
      const weights = reasons.map(r => r.weight)
      const variance = this.calculateVariance(weights)
      const diversityBonus = Math.max(0, 0.2 - variance)
      confidence += diversityBonus
    }

    return Math.min(1, Math.max(0, confidence))
  }

  /**
   * 应用多样性过滤
   */
  private applyDiversityFilter(
    recommendations: SmartRecommendation[],
    diversityFactor: number
  ): SmartRecommendation[] {
    if (diversityFactor <= 0 || recommendations.length <= 1) {
      return recommendations
    }

    const diverseResults: SmartRecommendation[] = []
    const usedDomains = new Set<string>()
    const usedTypes = new Map<RecommendationType, number>()

    for (const recommendation of recommendations) {
      let shouldInclude = true

      // 域名多样性检查
      if (recommendation.domain && usedDomains.has(recommendation.domain)) {
        const domainCount = Array.from(usedDomains).filter(d => d === recommendation.domain).length
        if (domainCount >= Math.ceil(recommendations.length * 0.3)) {
          shouldInclude = false
        }
      }

      // 推荐类型多样性检查
      const typeCount = usedTypes.get(recommendation.recommendationType) || 0
      if (typeCount >= Math.ceil(recommendations.length * 0.4)) {
        shouldInclude = false
      }

      if (shouldInclude) {
        diverseResults.push(recommendation)
        if (recommendation.domain) {
          usedDomains.add(recommendation.domain)
        }
        usedTypes.set(recommendation.recommendationType, typeCount + 1)
      }

      // 限制结果数量
      if (diverseResults.length >= recommendations.length * (1 - diversityFactor)) {
        break
      }
    }

    return diverseResults
  }

  /**
   * 分析用户行为模式
   * ✅ 符合单向数据流：从 IndexedDB 读取
   */
  private async analyzeUserBehaviorPattern(): Promise<UserBehaviorPattern> {
    try {
      logger.info('SmartRecommendation', '📊 分析用户行为模式...')

      // ✅ 确保 IndexedDB 已初始化
      await indexedDBManager.initialize()

      // ✅ 从 IndexedDB 获取所有书签进行分析
      const allBookmarks = await indexedDBManager.getAllBookmarks()
      const bookmarksWithUrls = allBookmarks.filter(b => b.url)

      // 分析时间偏好
      const timePattern = this.analyzeTimePattern(bookmarksWithUrls)

      // 分析域名偏好
      const domainPreferences = this.analyzeDomainPreferences(bookmarksWithUrls)

      // 分析内容偏好
      const contentPreferences = this.analyzeContentPreferences(bookmarksWithUrls)

      const pattern: UserBehaviorPattern = {
        ...timePattern,
        preferredDomains: domainPreferences,
        ...contentPreferences,

        // 默认值（实际使用中应该从用户行为数据计算）
        averageSessionDuration: 30,
        bookmarkingFrequency: 2,
        searchFrequency: 5,
        browsingStyle: 'goal-oriented',
        discoverability: 'medium'
      }

      this.userBehaviorPattern = pattern
      logger.info('SmartRecommendation', '✅ 用户行为模式分析完成')

      return pattern
    } catch (error) {
      logger.error('Component', 'SmartRecommendation', '❌ 行为模式分析失败', error)
      return this.getDefaultBehaviorPattern()
    }
  }

  /**
   * 分析时间模式
   */
  private analyzeTimePattern(bookmarks: BookmarkRecord[]) {
    const hours = new Map<number, number>()
    const days = new Map<number, number>()

    for (const bookmark of bookmarks) {
      const bookmarkWithUsage = bookmark as BookmarkWithUsage
      if (bookmarkWithUsage.dateLastUsed) {
        const date = new Date(bookmarkWithUsage.dateLastUsed)
        const hour = date.getHours()
        const day = date.getDay()

        hours.set(hour, (hours.get(hour) || 0) + 1)
        days.set(day, (days.get(day) || 0) + 1)
      }
    }

    // 找到活跃时间段（使用频率前50%的时间）
    const sortedHours = Array.from(hours.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.ceil(hours.size * 0.5))
      .map(([hour]) => hour)

    const sortedDays = Array.from(days.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.ceil(days.size * 0.6))
      .map(([day]) => day)

    const peakHour = sortedHours[0] ?? 14 // 默认下午2点

    return {
      activeHours: sortedHours,
      activeDays: sortedDays,
      peakUsageTime: peakHour
    }
  }

  /**
   * 分析域名偏好
   */
  private analyzeDomainPreferences(bookmarks: BookmarkRecord[]): DomainPreference[] {
    const domainStats = new Map<
      string,
      {
        count: number
        lastVisit: number
        totalBookmarks: number
      }
    >()

    for (const bookmark of bookmarks) {
      if (bookmark.url) {
        const domain = this.extractDomain(bookmark.url)
        if (!domain) continue

        const existing = domainStats.get(domain) || {
          count: 0,
          lastVisit: 0,
          totalBookmarks: 0
        }
        existing.totalBookmarks += 1

        const bookmarkWithUsage = bookmark as BookmarkWithUsage
        if (bookmarkWithUsage.dateLastUsed) {
          existing.count += 1
          existing.lastVisit = Math.max(existing.lastVisit, bookmarkWithUsage.dateLastUsed)
        }

        domainStats.set(domain, existing)
      }
    }

    return Array.from(domainStats.entries())
      .map(([domain, stats]) => ({
        domain,
        visitCount: stats.count,
        averageStayTime: 0, // 无法从书签数据获取
        lastVisit: stats.lastVisit,
        preference: Math.min(1, (stats.count + stats.totalBookmarks) / 10)
      }))
      .sort((a, b) => b.preference - a.preference)
      .slice(0, 20) // 前20个偏好域名
  }

  /**
   * 分析内容偏好
   * @param {BookmarkRecord[]} bookmarks 书签列表
   * @returns {ContentPreference[]} 内容偏好
   */
  private analyzeContentPreferences(bookmarks: BookmarkRecord[]) {
    const keywords = new Map<string, number>()

    for (const bookmark of bookmarks) {
      const text = `${bookmark.title || ''} ${bookmark.url || ''}`.toLowerCase()
      const words = text.match(/\b\w{3,}\b/g) || []

      for (const word of words) {
        if (this.isValidKeyword(word)) {
          keywords.set(word, (keywords.get(word) || 0) + 1)
        }
      }
    }

    const commonKeywords = Array.from(keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([keyword]) => keyword)

    return {
      preferredCategories: [], // TODO: 基于域名和关键词分类
      commonKeywords
    }
  }

  // ==================== 辅助方法 ====================

  private extractDomain(url: string): string | undefined {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return undefined
    }
  }

  /**
   * 获取书签路径
   * ✅ 符合单向数据流：从 IndexedDB 读取
   */
  private async getBookmarkPath(id: string): Promise<string[]> {
    try {
      // ✅ 确保 IndexedDB 已初始化
      await indexedDBManager.initialize()

      const path: string[] = []
      let currentId = id

      while (currentId && currentId !== '0') {
        // ✅ 从 IndexedDB 获取书签
        const node = await indexedDBManager.getBookmarkById(currentId)
        if (!node) break

        path.unshift(node.title || '')
        currentId = node.parentId || ''
      }

      return path
    } catch {
      return []
    }
  }

  /**
   * 估算访问次数
   * @param {BookmarkRecord} bookmark 书签
   * @returns {number} 访问次数
   */
  private estimateVisitCount(bookmark: BookmarkRecord): number {
    // 简化的访问次数估算
    const bookmarkWithUsage = bookmark as BookmarkWithUsage
    if (!bookmarkWithUsage.dateLastUsed || !bookmark.dateAdded) return 1

    const daysSinceAdded = (Date.now() - bookmark.dateAdded) / (1000 * 60 * 60 * 24)
    const daysSinceUsed = (Date.now() - bookmarkWithUsage.dateLastUsed) / (1000 * 60 * 60 * 24)

    if (daysSinceUsed > 30) return 1 // 长时间未使用
    if (daysSinceUsed < 1) return Math.ceil(daysSinceAdded / 7) // 最近使用，估算每周使用

    return Math.max(1, Math.ceil(daysSinceAdded / daysSinceUsed))
  }

  private calculateRecentVisitCount(bookmark: BookmarkRecord): number {
    const bookmarkWithUsage = bookmark as BookmarkWithUsage
    if (!bookmarkWithUsage.dateLastUsed) return 0

    const daysSinceUsed = (Date.now() - bookmarkWithUsage.dateLastUsed) / (1000 * 60 * 60 * 24)

    if (daysSinceUsed > 7) return 0
    if (daysSinceUsed < 1) return 3 // 今天使用，假设多次
    if (daysSinceUsed < 3) return 2 // 最近几天使用

    return 1
  }

  private calculateAverageVisitInterval(bookmark: BookmarkRecord): number {
    const bookmarkWithUsage = bookmark as BookmarkWithUsage
    if (!bookmark.dateAdded || !bookmarkWithUsage.dateLastUsed) return 0

    const totalDays = (bookmarkWithUsage.dateLastUsed - bookmark.dateAdded) / (1000 * 60 * 60 * 24)
    const estimatedVisits = this.estimateVisitCount(bookmark)

    return totalDays / Math.max(estimatedVisits, 1)
  }

  /**
   * 获取最近书签
   * ✅ 符合单向数据流：从 IndexedDB 读取
   */
  private async getRecentBookmarks(days: number = 7): Promise<BookmarkRecord[]> {
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000

    // ✅ 确保 IndexedDB 已初始化
    await indexedDBManager.initialize()

    // ✅ 从 IndexedDB 获取所有书签
    const allBookmarks = await indexedDBManager.getAllBookmarks()

    return allBookmarks.filter(
      bookmark =>
        bookmark.url &&
        (((bookmark as BookmarkWithUsage).dateLastUsed &&
          (bookmark as BookmarkWithUsage).dateLastUsed! > threshold) ||
          (bookmark.dateAdded && bookmark.dateAdded > threshold))
    )
  }

  /**
   * 判断关键词是否有效
   * @param {string} word 关键词
   * @returns {boolean} 是否有效
   */
  private isValidKeyword(word: string): boolean {
    // 过滤常见的无意义词汇
    const stopWords = new Set([
      'the',
      'and',
      'for',
      'are',
      'but',
      'not',
      'you',
      'all',
      'can',
      'had',
      'her',
      'was',
      'one',
      'our',
      'out',
      'day',
      'get',
      'has',
      'him',
      'his',
      'how',
      'man',
      'new',
      'now',
      'old',
      'see',
      'two',
      'way',
      'who',
      'boy',
      'did',
      'its',
      'let',
      'put',
      'say',
      'she',
      'too',
      'use',
      'com',
      'www',
      'http',
      'https',
      'html',
      'php',
      'asp',
      'jsp'
    ])

    return word.length >= 3 && word.length <= 20 && !stopWords.has(word) && !/^\d+$/.test(word)
  }

  /**
   * 计算方差
   * @param {number[]} numbers 数字列表
   * @returns {number} 方差
   */
  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0

    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2))

    return squaredDiffs.reduce((sum, sq) => sum + sq, 0) / numbers.length
  }

  /**
   * 获取默认行为模式
   * @returns {UserBehaviorPattern} 默认行为模式
   */
  private getDefaultBehaviorPattern(): UserBehaviorPattern {
    return {
      activeHours: [9, 10, 11, 14, 15, 16, 19, 20, 21],
      activeDays: [1, 2, 3, 4, 5], // 工作日
      peakUsageTime: 14,
      averageSessionDuration: 30,
      bookmarkingFrequency: 2,
      searchFrequency: 5,
      preferredDomains: [],
      preferredCategories: [],
      commonKeywords: [],
      browsingStyle: 'goal-oriented',
      discoverability: 'medium'
    }
  }

  /**
   * 初始化统计
   * @returns {RecommendationStats} 统计
   */
  private initializeStats(): RecommendationStats {
    return {
      totalRecommendations: 0,
      acceptedRecommendations: 0,
      rejectedRecommendations: 0,
      clickThroughRate: 0,
      averageConfidence: 0,
      topRecommendationTypes: {},
      performanceMetrics: {
        generationTime: 0,
        accuracy: 0,
        diversity: 0,
        novelty: 0
      }
    }
  }

  /**
   * 更新性能统计
   * @param {SmartRecommendation[]} recommendations 推荐列表
   * @param {number} duration 持续时间
   * @returns {void} 更新性能统计
   */
  private updatePerformanceStats(recommendations: SmartRecommendation[], duration: number): void {
    this.performanceStats.totalRecommendations += recommendations.length
    this.performanceStats.performanceMetrics.generationTime = duration

    if (recommendations.length > 0) {
      this.performanceStats.averageConfidence =
        recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length
    }

    // 更新推荐类型统计
    for (const rec of recommendations) {
      const type = rec.recommendationType
      this.performanceStats.topRecommendationTypes[type] =
        (this.performanceStats.topRecommendationTypes[type] || 0) + 1
    }
  }

  // ==================== 公共API ====================

  /**
   * 记录推荐反馈
   * @param {string} _recommendationId 推荐ID
   * @param {string} feedback 反馈
   * @returns {void} 记录推荐反馈
   */
  recordRecommendationFeedback(
    _recommendationId: string,
    feedback: 'accepted' | 'rejected' | 'clicked'
  ): void {
    switch (feedback) {
      case 'accepted':
        this.performanceStats.acceptedRecommendations++
        break
      case 'rejected':
        this.performanceStats.rejectedRecommendations++
        break
      case 'clicked': {
        // 更新点击率
        const total =
          this.performanceStats.acceptedRecommendations +
          this.performanceStats.rejectedRecommendations
        if (total > 0) {
          this.performanceStats.clickThroughRate =
            this.performanceStats.acceptedRecommendations / total
        }
        break
      }
    }
  }

  /**
   * 获取推荐统计
   * @returns {RecommendationStats} 推荐统计
   */
  getRecommendationStats(): RecommendationStats {
    return { ...this.performanceStats }
  }

  /**
   * 清除推荐缓存
   * @returns {void} 清除推荐缓存
   */
  clearRecommendationCache(): void {
    this.recommendationHistory.clear()
    logger.info('SmartRecommendation', '🧹 推荐缓存已清理')
  }

  /**
   * 智能全量爬取策略 - URL去重 + 高效批处理
   * ⚠️ 此方法已改为 public，可在控制台手动调用进行测试
   */
  public smartEnhanceAllBookmarks(bookmarks: BookmarkRecord[]): void {
    // 异步执行，不等待结果
    setTimeout(async () => {
      try {
        const validBookmarks = bookmarks.filter(
          bookmark =>
            bookmark.url &&
            !bookmark.url.startsWith('chrome://') &&
            !bookmark.url.startsWith('chrome-extension://')
        )

        logger.info('SmartEnhancer', `🌟 启动智能全量爬取: ${validBookmarks.length}个书签`)
        logger.info('SmartEnhancer', '🧠 策略: URL去重 → 优先级排序 → 分批处理 → 智能间隔')

        // 🎯 Step 1: URL去重和分组 - 核心优化！
        const urlGrouping = this.groupBookmarksByUrl(validBookmarks)
        const uniqueUrls = Object.keys(urlGrouping)
        logger.info(
          'SmartEnhancer',
          `🔗 URL去重完成: ${validBookmarks.length}个书签 → ${uniqueUrls.length}个唯一URL`
        )

        // 📊 显示去重统计
        const duplicateCount = validBookmarks.length - uniqueUrls.length
        if (duplicateCount > 0) {
          logger.info('SmartEnhancer', `♻️ 发现${duplicateCount}个重复URL，将复用爬取结果`)
        }

        // 🎯 Step 2: 选择代表书签并按优先级排序
        const representativeBookmarks = this.selectRepresentativeBookmarks(urlGrouping)
        const prioritizedBookmarks = this.prioritizeBookmarks(representativeBookmarks)

        // 🔄 Step 3: 分批并发处理，使用全局爬虫限速配置
        const BATCH_SIZE = CRAWLER_CONFIG.BATCH_SIZE
        const BATCH_INTERVAL = CRAWLER_CONFIG.BATCH_INTERVAL_MS
        const IDLE_DELAY = CRAWLER_CONFIG.USE_IDLE_SCHEDULING ? CRAWLER_CONFIG.IDLE_DELAY_MS : 0

        for (let i = 0; i < prioritizedBookmarks.length; i += BATCH_SIZE) {
          const batch = prioritizedBookmarks.slice(i, i + BATCH_SIZE)
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1
          const totalBatches = Math.ceil(prioritizedBookmarks.length / BATCH_SIZE)

          // 延迟执行每个批次
          setTimeout(
            async () => {
              logger.info(
                'SmartEnhancer',
                `📦 处理第${batchNumber}/${totalBatches}批 (${batch.length}个唯一URL)`
              )

              // ✅ 串行处理当前批次的书签，等待前一个任务完成（而非固定延迟）
              let previousPromise = Promise.resolve()
              let batchIndex = 0
              for (const bookmark of batch) {
                const currentIndex = i + batchIndex
                previousPromise = previousPromise
                  .then(async () => {
                    try {
                      logger.info(
                        'SmartEnhancer',
                        `✅ [${currentIndex + 1}/${prioritizedBookmarks.length}] ${bookmark.title || ''}`
                      )

                      // 🔄 记录相同URL的书签复用情况
                      const sameUrlBookmarks = urlGrouping[bookmark.url!]
                      if (!sameUrlBookmarks) {
                        return
                      }
                      await this.propagateEnhancementToSameUrl(null, sameUrlBookmarks)
                    } catch (error) {
                      logger.warn(
                        'SmartEnhancer',
                        `⚠️ [${currentIndex + 1}/${prioritizedBookmarks.length}] 增强失败: ${bookmark.title}`,
                        error
                      )
                    }
                  })
                  .catch(() => {
                    // 忽略错误，不阻塞后续任务
                  })

                batchIndex++
              }

              // 等待当前批次全部完成
              await previousPromise

              logger.info('SmartEnhancer', `🎉 第${batchNumber}批处理完成`)

              // 如果是最后一批，显示完成统计
              if (batchNumber === totalBatches) {
                logger.info('SmartEnhancer', '🏆 全量增强任务完成!')
                logger.info('SmartEnhancer', `♻️ URL复用节省了${duplicateCount}次网络请求`)
              }
            },
            IDLE_DELAY + batchNumber * BATCH_INTERVAL
          ) // 可选空闲延迟 + 批间隔
        }
      } catch (error) {
        logger.error('Component', 'SmartEnhancer', '❌ 智能全量爬取失败', error)
      }
    }, 100) // 延迟100ms执行，确保不阻塞推荐生成
  }

  /**
   * 🔗 按URL分组书签 - 实现URL去重
   */
  private groupBookmarksByUrl(bookmarks: BookmarkRecord[]): Record<string, BookmarkRecord[]> {
    const urlGroups: Record<string, BookmarkRecord[]> = {}

    for (const bookmark of bookmarks) {
      if (bookmark.url) {
        const existingGroup = urlGroups[bookmark.url]
        if (existingGroup) {
          existingGroup.push(bookmark)
        } else {
          urlGroups[bookmark.url] = [bookmark]
        }
      }
    }

    return urlGroups
  }

  /**
   * 🎯 从每个URL组中选择代表性书签 - 选择最优质的书签进行爬取
   */
  private selectRepresentativeBookmarks(
    urlGroups: Record<string, BookmarkRecord[]>
  ): BookmarkRecord[] {
    const representatives: BookmarkRecord[] = []

    for (const [url, bookmarksGroup] of Object.entries(urlGroups)) {
      if (bookmarksGroup.length === 1) {
        // 只有一个书签，直接选择
        const firstBookmark = bookmarksGroup[0]
        if (firstBookmark) {
          representatives.push(firstBookmark)
        }
      } else {
        // 有多个书签，选择最优质的一个
        const bestBookmark = bookmarksGroup.slice().sort((a, b) => {
          // 1. 有标题的优先
          if (a.title && !b.title) return -1
          if (!a.title && b.title) return 1

          // 2. 最近使用的优先
          const aWithUsage = a as BookmarkWithUsage
          const bWithUsage = b as BookmarkWithUsage
          const lastUsedA = aWithUsage.dateLastUsed || 0
          const lastUsedB = bWithUsage.dateLastUsed || 0
          if (lastUsedB !== lastUsedA) return lastUsedB - lastUsedA

          // 3. 最近添加的优先
          const dateAddedA = a.dateAdded || 0
          const dateAddedB = b.dateAdded || 0
          return dateAddedB - dateAddedA
        })[0]

        if (!bestBookmark) {
          continue
        }
        representatives.push(bestBookmark)
        logger.info(
          'SmartEnhancer',
          `🔄 ${url}: ${bookmarksGroup.length}个重复书签 → 选择"${bestBookmark.title}"`
        )
      }
    }

    return representatives
  }

  /**
   * ♻️ 记录相同URL书签的复用情况
   *
   * ✅ 数据已自动保存到 IndexedDB，此方法仅保留用于日志记录
   */
  private async propagateEnhancementToSameUrl(
    _enhancedData: null,
    bookmarksWithSameUrl: BookmarkRecord[]
  ): Promise<void> {
    try {
      if (bookmarksWithSameUrl.length > 1) {
        logger.info('SmartEnhancer', `♻️ 复用爬取结果到${bookmarksWithSameUrl.length}个重复书签`)
      }
    } catch (error) {
      logger.error('Component', 'SmartEnhancer', '❌ 结果传播失败', error)
    }
  }

  /**
   * 📊 书签优先级排序策略
   */
  private prioritizeBookmarks(bookmarks: BookmarkRecord[]): BookmarkRecord[] {
    return bookmarks.slice().sort((a, b) => {
      // 1. 最近添加的书签优先级更高
      const timeA = a.dateAdded || 0
      const timeB = b.dateAdded || 0
      const timeDiff = timeB - timeA

      // 2. 最近使用的书签优先级更高
      const aWithUsage = a as BookmarkWithUsage
      const bWithUsage = b as BookmarkWithUsage
      const lastUsedA = aWithUsage.dateLastUsed || 0
      const lastUsedB = bWithUsage.dateLastUsed || 0
      const usageDiff = lastUsedB - lastUsedA

      // 3. 综合评分：最近使用权重70%，最近添加权重30%
      return usageDiff * 0.7 + timeDiff * 0.3
    })
  }
}

// ==================== 导出 ====================

// 单例模式
let smartRecommendationEngineInstance: SmartRecommendationEngine | null = null

export function getSmartRecommendationEngine(): SmartRecommendationEngine {
  if (!smartRecommendationEngineInstance) {
    smartRecommendationEngineInstance = new SmartRecommendationEngine()
  }
  return smartRecommendationEngineInstance
}

// 默认导出
export default SmartRecommendationEngine
