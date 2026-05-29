// 统一事件常量，避免各处硬编码字符串
export const AB_EVENTS = {
  // UI 层书签更新事件（由现代书签服务派发，UI 监听）
  BOOKMARK_UPDATED: 'acuity-bookmark-updated',
  BOOKMARKS_DB_SYNCED: 'acuity-bookmarks-db-synced'
} as const

export type AbEventKey = keyof typeof AB_EVENTS
export type AbEventName = (typeof AB_EVENTS)[AbEventKey]
