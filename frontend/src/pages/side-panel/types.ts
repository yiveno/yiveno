import type { EnhancedSearchResult } from '@/core/query-engine'
import type { BookmarkNode } from '@/types'
import type { SmartRecommendation } from '@/application/bookmark/recommendation-app-service'

/** 侧边栏搜索结果项。 */
export interface SidePanelSearchItem {
  bookmark: { id: string; title: string; url?: string; path?: string[] }
  score: number
  matchedFields: string[]
  highlights: EnhancedSearchResult['highlights']
}

/** 书签更新事件详情。 */
export interface BookmarkUpdateDetail {
  eventType: string
  id: string
  [key: string]: unknown
}

export type RecommendationItem = SmartRecommendation
export type { EnhancedSearchResult, BookmarkNode }
