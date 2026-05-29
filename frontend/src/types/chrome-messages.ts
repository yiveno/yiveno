/**
 * Chrome Extension 消息类型定义
 */

/**
 * 同步进度消息
 */
export interface SyncProgressMessage {
  type: 'acuity-bookmarks-sync-progress'
  data: {
    percentage: number
    message: string
    phase?: 'initializing' | 'syncing' | 'completed'
  }
}

/**
 * 数据库就绪消息
 */
export interface DBReadyMessage {
  type: 'acuity-bookmarks-db-ready'
}

/**
 * 所有 Chrome Extension 消息类型
 */
export type ChromeExtensionMessage = SyncProgressMessage | DBReadyMessage
