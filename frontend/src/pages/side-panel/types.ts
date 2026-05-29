import type { EnhancedSearchResult } from '@/core/query-engine'
import type { BookmarkNode } from '@/types'
import type { SmartRecommendation } from '@/application/bookmark/recommendation-app-service'

/**
 * 侧边栏搜索结果项的数据结构，保留必要的书签字段与高亮信息。
 */
export interface SidePanelSearchItem {
  bookmark: {
    id: string
    title: string
    url?: string | undefined
    path?: string[] | undefined
  }
  score: number
  matchedFields: string[]
  highlights: EnhancedSearchResult['highlights']
}

/**
 * 书签更新事件详情，用于提示用户刷新侧边栏。
 */
export interface BookmarkUpdateDetail {
  eventType: string
  id: string
  [key: string]: unknown
}

/**
 * 智能推荐条目的简化类型别名，便于侧边栏函数签名引用。
 */
export type RecommendationItem = SmartRecommendation

export type { EnhancedSearchResult, BookmarkNode }
