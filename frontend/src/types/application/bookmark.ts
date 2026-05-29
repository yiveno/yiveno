/**
 * 与书签应用服务交互时使用的类型集合。
 */
import type { BookmarkNode } from '@/types/domain/bookmark'
import type { SmartBookmarkExecutor } from '@/core/bookmark/services/executor'
import type { ProgressCallback } from '@/core/bookmark/services/executor'

/** 书签导入任务的元信息。 */
export interface BookmarkImportPayload {
  /** 原始文件名 */
  fileName: string
  /** 文件大小（字节） */
  size: number
  /** 导入操作的时间戳（毫秒） */
  importedAt: number
}

/** 书签差异概览，用于 UI 展示统计信息。 */
export interface BookmarkChangeSummary {
  /** 新增的节点数量 */
  created: number
  /** 更新的节点数量 */
  updated: number
  /** 删除的节点数量 */
  deleted: number
  /** 移动的节点数量 */
  moved: number
}

/**
 * 在导入/批量操作时用于描述原始树与目标树的差异。
 */
export interface BookmarkDiffPayload {
  /** 原始树节点集合 */
  before: BookmarkNode[]
  /** 目标树节点集合 */
  after: BookmarkNode[]
  /** 概览统计 */
  summary: BookmarkChangeSummary
}

/**
 * 书签执行计划的可选参数。
 *
 * 可用于控制并发、重试策略以及自定义执行器。
 */
export interface PlanAndExecuteOptions {
  /** 是否仅模拟执行（不真正调用 Chrome API） */
  dryRun?: boolean
  /** 自定义并发阈值，覆盖默认策略 */
  maxConcurrent?: number
  /** 重试策略配置 */
  retry?: {
    /** 最大重试次数 */
    maxAttempts: number
    /** 重试之间的等待毫秒数 */
    delayMs: number
  }
  /** 自定义执行器实例，允许注入不同实现 */
  executor?: SmartBookmarkExecutor
  /** 进度回调，便于显示进度条或统计信息 */
  onProgress?: ProgressCallback
}
