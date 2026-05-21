/**
 * 查询领域类型定义
 *
 * 包含查询功能相关的所有类型定义
 */

import type { ID, Timestamp } from '../core/common'
import type { BookmarkRecord } from './bookmark'

/**
 * 查询策略类型
 *
 * fuse     - 本地 Fuse.js 模糊匹配（快，适合精确关键词）
 * semantic - Vectorize 语义搜索（准，适合自然语言）
 * hybrid   - 先 Fuse 立即返回，异步 Semantic 合并更新
 * auto     - 自动根据输入意图选择策略（推荐）
 */
export type SearchStrategy = 'fuse' | 'semantic' | 'hybrid' | 'auto'

/**
 * 查询排序字段
 *
 * 可以用于排序的字段
 */
export type SearchSortBy = 'relevance' | 'title' | 'date' | 'frequency' | 'url'

/**
 * 排序顺序
 *
 * 升序或降序
 */
export type SortOrder = 'asc' | 'desc'

/**
 * 查询选项接口
 *
 * 配置查询行为的选项
 *
 * @example
 * ```typescript
 * const options: SearchOptions = {
 *   strategy: 'fuse',
 *   limit: 50,
 *   highlight: true,
 *   sortBy: 'relevance'
 * }
 * ```
 */
export interface SearchOptions extends Record<string, unknown> {
  /** 查询策略（可选，默认为 'fuse'） */
  strategy?: SearchStrategy | undefined

  /** 结果限制数量 */
  limit?: number | undefined

  /** 偏移量（分页） */
  offset?: number | undefined

  /** 排序字段 */
  sortBy?: SearchSortBy | undefined

  /** 排序顺序 */
  sortOrder?: SortOrder | undefined

  /** 是否过滤文件夹 */
  filterFolders?: boolean | undefined

  /** 是否过滤书签 */
  filterBookmarks?: boolean | undefined

  /** 域名过滤列表 */
  domainFilter?: string[] | undefined

  /** 是否启用高亮 */
  highlight?: boolean | undefined

  /** 高亮标签名 */
  highlightTag?: string | undefined

  /** 是否使用缓存 */
  useCache?: boolean | undefined

  /** 仅使用缓存（不执行新查询） */
  cacheOnly?: boolean | undefined

  /** 超时时间（毫秒） */
  timeout?: number | undefined

  /** 最低分数阈值 */
  minScore?: number | undefined

  /** 模糊匹配阈值 (0-1) */
  fuzzyThreshold?: number | undefined

  /** 是否包含元数据 */
  includeMetadata?: boolean | undefined
}

/**
 * 高亮片段接口
 *
 * 表示文本中的一个片段，标记是否为匹配部分
 *
 * @example
 * ```typescript
 * const segment: HighlightSegment = {
 *   text: 'React',
 *   isMatch: true,
 *   start: 0,
 *   end: 5
 * }
 * ```
 */
export interface HighlightSegment {
  /** 片段文本内容 */
  text: string

  /** 是否为匹配部分 */
  isMatch: boolean

  /** 起始位置 */
  start: number

  /** 结束位置 */
  end: number
}

/**
 * 相关性因素接口
 *
 * 影响查询结果相关性的各个因素及其权重
 */
export interface RelevanceFactors {
  /** 标题匹配度 (0-1) */
  titleMatch: number

  /** URL匹配度 (0-1) */
  urlMatch: number

  /** 域名匹配度 (0-1) */
  domainMatch: number

  /** 关键词匹配度 (0-1) */
  keywordMatch: number

  /** 精确匹配加分 (0-1) */
  exactMatch: number

  /** 最近使用加分 (0-1) */
  recencyBoost: number

  /** 点击频率加分 (0-1) */
  clickBoost: number
}

/**
 * 增强查询结果接口
 *
 * 包含书签信息、评分、高亮等完整查询结果
 *
 * @example
 * ```typescript
 * const result: EnhancedSearchResult = {
 *   bookmark: bookmarkRecord,
 *   score: 0.95,
 *   matchedFields: ['title', 'url'],
 *   highlights: {
 *     title: [{ text: 'React', isMatch: true, start: 0, end: 5 }]
 *   }
 * }
 * ```
 */
export interface EnhancedSearchResult {
  /** 书签记录 */
  bookmark: BookmarkRecord

  /** 相关性分数 (0-1，越大越相关) */
  score: number

  /** 书签完整路径字符串（用于展示层级信息） */
  pathString?: string

  /** 匹配的字段列表 */
  matchedFields: string[]

  /** 高亮信息 */
  highlights: {
    /** 标题高亮 */
    title?: HighlightSegment[]
    /** URL高亮 */
    url?: HighlightSegment[]
    /** 域名高亮 */
    domain?: HighlightSegment[]
  }

  /** 相关性因素（可选） */
  relevanceFactors?: RelevanceFactors
}

/**
 * 查询结果元数据接口
 *
 * 查询执行的元数据信息
 */
export interface SearchResultMetadata {
  /** 查询耗时（毫秒） */
  searchTime: number

  /** 总结果数量 */
  totalResults: number

  /** 是否缓存命中 */
  cacheHit: boolean

  /** 使用的查询策略 */
  strategy: string

  /** 规范化后的查询 */
  queryNormalized: string

  /** 查询时间戳 */
  timestamp?: Timestamp
}

/**
 * 查询响应接口
 *
 * 完整的查询响应，包含结果和元数据
 *
 * @example
 * ```typescript
 * const response: SearchResponse = {
 *   results: [],
 *   metadata: {
 *     searchTime: 45,
 *     totalResults: 100,
 *     cacheHit: false,
 *     strategy: 'fuse',
 *     queryNormalized: 'react'
 *   },
 *   suggestions: ['react hooks', 'react native']
 * }
 * ```
 */
export interface SearchResponse {
  /** 查询结果列表 */
  results: EnhancedSearchResult[]

  /** 查询元数据 */
  metadata: SearchResultMetadata

  /** 查询建议（可选） */
  suggestions?: string[]

  /** 相关查询（可选） */
  relatedSearches?: string[]
}

/**
 * 查询统计信息接口
 *
 * 查询功能的统计数据
 */
export interface SearchStats {
  /** 总查询次数 */
  totalSearches: number

  /** 缓存命中率 (0-1) */
  cacheHitRate: number

  /** 平均查询时间（毫秒） */
  averageSearchTime: number

  /** 中位数查询时间（毫秒） */
  medianSearchTime?: number

  /** P95 响应时间（毫秒） */
  p95ResponseTime?: number

  /** 热门查询列表 */
  popularQueries: Array<{
    /** 查询文本 */
    query: string
    /** 查询次数 */
    count: number
    /** 平均耗时 */
    avgTime: number
    /** 最后使用时间 */
    lastUsed?: Timestamp
  }>

  /** 成功率 (0-1) */
  successRate?: number

  /** 错误率 (0-1) */
  errorRate?: number
}

/**
 * 查询事件类型
 *
 * 查询过程中可能触发的事件类型
 */
export type SearchEventType =
  | 'search:start'
  | 'search:complete'
  | 'search:error'
  | 'search:cached'
  | 'index:building'
  | 'index:ready'
  | 'index:updated'
  | 'index:error'

/**
 * 查询事件接口
 *
 * 查询事件的数据结构
 */
export interface SearchEvent {
  /** 事件类型 */
  type: SearchEventType

  /** 事件时间戳 */
  timestamp: Timestamp

  /** 事件数据 */
  data?: Record<string, unknown>

  /** 相关查询 */
  query?: string

  /** 错误信息（如果是错误事件） */
  error?: string
}

/**
 * 索引状态接口
 *
 * 查询索引的当前状态
 */
export interface IndexStatus {
  /** 是否正在构建 */
  isBuilding: boolean

  /** 是否已就绪 */
  isReady: boolean

  /** 最后构建时间 */
  lastBuilt: Timestamp | null

  /** 文档数量 */
  documentCount: number

  /** 索引版本 */
  version: number

  /** 索引大小（字节） */
  size?: number

  /** 错误信息 */
  error?: string
}

/**
 * 缓存配置接口
 *
 * 查询缓存的配置选项
 */
export interface CacheConfig {
  /** 是否启用缓存 */
  enabled: boolean

  /** 最大缓存条目数 */
  maxSize: number

  /** 缓存过期时间（毫秒） */
  ttl: number

  /** 缓存策略 */
  strategy: 'lru' | 'lfu' | 'fifo'

  /** 是否持久化 */
  persistent?: boolean
}

/**
 * Worker 配置接口
 *
 * 查询 Worker 的配置选项
 */
export interface WorkerConfig {
  /** 是否启用 Worker */
  enabled: boolean

  /** Worker 池大小 */
  poolSize: number

  /** 超时时间（毫秒） */
  timeout: number

  /** 批处理大小 */
  batchSize: number

  /** 是否预热 */
  warmup?: boolean
}

/**
 * 查询历史记录接口
 *
 * 用户的查询历史
 */
export interface SearchHistory {
  /** 历史记录ID */
  id: ID

  /** 查询文本 */
  query: string

  /** 查询时间 */
  timestamp: Timestamp

  /** 结果数量 */
  resultCount: number

  /** 是否点击了结果 */
  clicked: boolean

  /** 点击的书签ID */
  clickedBookmarkId?: ID

  /** 查询耗时 */
  duration?: number
}

/**
 * 查询建议接口
 *
 * 查询自动补全建议
 */
export interface SearchSuggestion {
  /** 建议文本 */
  text: string

  /** 建议类型 */
  type: 'history' | 'popular' | 'completion' | 'related'

  /** 相关性分数 */
  score: number

  /** 使用次数 */
  frequency?: number

  /** 最后使用时间 */
  lastUsed?: Timestamp
}

/**
 * 查询过滤器接口
 *
 * 高级查询过滤条件
 */
export interface SearchFilter {
  /** 域名过滤 */
  domains?: string[]

  /** 标签过滤 */
  tags?: string[]

  /** 日期范围 */
  dateRange?: {
    /** 开始时间 */
    start?: Timestamp
    /** 结束时间 */
    end?: Timestamp
  }

  /** 文件夹ID过滤 */
  folderIds?: ID[]

  /** 是否已访问 */
  visited?: boolean

  /** 是否收藏 */
  favorited?: boolean
}

/**
 * 查询结果简单格式
 *
 * 用于 Popup 等简单场景的查询结果
 */
export interface SearchResult {
  /** 书签 ID */
  id: ID

  /** 评分（0-1） */
  score: number

  /** 书签记录 */
  bookmark: BookmarkRecord

  /** 书签完整路径字符串（用于展示层级信息） */
  pathString?: string
}

/**
 * Worker 查询文档接口
 *
 * Worker 中使用的轻量级文档格式
 */
export interface WorkerDoc {
  /** 文档ID */
  id: string

  /** 标题（小写） */
  titleLower: string

  /** 原始标题（用于展示） */
  title?: string | undefined

  /** URL（小写） */
  urlLower?: string | undefined

  /** 原始 URL（用于展示） */
  url?: string | undefined

  /** 域名 */
  domain?: string | undefined

  /** 关键词 */
  keywords?: string[] | undefined

  /** 是否为文件夹 */
  isFolder?: boolean | undefined
}

/**
 * Worker 查询命中结果
 *
 * Worker 返回的查询结果
 */
export interface WorkerHit {
  /** 文档ID */
  id: string

  /** 相关性分数 */
  score: number
}

/**
 * Worker 初始化选项
 */
export interface WorkerInitOptions {
  /** 搜索字段配置 */
  keys?: Array<{ name: string; weight: number }>

  /** 模糊匹配阈值 (0-1) */
  threshold?: number
}

/**
 * Worker 命令类型
 *
 * 主线程发送给 Worker 的命令
 */
export type SearchWorkerCommand =
  | {
      /** 初始化命令 */
      type: 'init'
      /** 初始文档列表 */
      docs: WorkerDoc[]
      /** 初始化选项 */
      options?: WorkerInitOptions | undefined
    }
  | {
      /** 查询命令 */
      type: 'query'
      /** 查询文本 */
      q: string
      /** 结果数量限制 */
      limit?: number | undefined
      /** 请求ID */
      reqId?: number | undefined
    }
  | {
      /** 增量更新命令 */
      type: 'applyPatch'
      /** 新增文档 */
      adds?: WorkerDoc[] | undefined
      /** 更新文档 */
      updates?: WorkerDoc[] | undefined
      /** 删除文档ID */
      removes?: string[] | undefined
    }
  | {
      /** 销毁命令 */
      type: 'dispose'
    }

/**
 * Worker 事件类型
 *
 * Worker 发送给主线程的事件
 */
export type SearchWorkerEvent =
  | {
      /** Worker 就绪事件 */
      type: 'ready'
    }
  | {
      /** 初始化完成事件 */
      type: 'inited'
      /** 文档数量 */
      docCount: number
    }
  | {
      /** 查询结果事件 */
      type: 'result'
      /** 请求ID */
      reqId?: number | undefined
      /** 命中结果 */
      hits: WorkerHit[]
    }
  | {
      /** 错误事件 */
      type: 'error'
      /** 错误消息 */
      message: string
      /** 请求ID */
      reqId?: number | undefined
    }

/**
 * 查询性能指标接口
 *
 * 查询性能监控指标
 */
export interface SearchPerformanceMetrics {
  /** 查询文本 */
  query: string

  /** 查询耗时 */
  duration: number

  /** 结果数量 */
  resultCount: number

  /** 是否缓存命中 */
  cacheHit: boolean

  /** 查询模式 */
  searchMode: string

  /** 时间戳 */
  timestamp: Timestamp

  /** 会话ID */
  sessionId?: string | undefined

  /** 数据源 */
  sources: string[]

  /** 是否成功 */
  success: boolean

  /** 错误信息 */
  errorMessage?: string | undefined
}
