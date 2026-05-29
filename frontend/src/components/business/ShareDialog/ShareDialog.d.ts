/**
 * ShareDialog 组件类型定义
 */

import type { BookmarkNode } from '@/types'

/**
 * ShareDialog Props
 */
export interface ShareDialogProps {
  /** 是否显示弹窗 */
  show: boolean
  /** 书签列表 */
  bookmarks: BookmarkNode[]
  /** 分享类型 */
  shareType: 'favorites' | 'folder' | 'bookmark'
  /** 文件夹名称（分享文件夹时） */
  folderName?: string
}

/**
 * ShareDialog Emits
 */
export interface ShareDialogEmits {
  /** 更新显示状态 */
  (e: 'update:show', value: boolean): void
  /** 分享完成 */
  (e: 'shareComplete'): void
}
