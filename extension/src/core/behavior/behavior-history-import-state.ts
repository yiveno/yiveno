/**
 * 浏览记录导入状态（chrome.storage.local；本地-only）。
 */

import { z } from 'zod'

/** 浏览记录导入状态存储键。 */
export const BEHAVIOR_HISTORY_IMPORT_STORAGE_KEY = 'yiveno:behavior_history_import' as const

/** 导入失败面向 UI 的稳定错误码。 */
export const BehaviorHistoryImportErrorCodeSchema = z.enum([
  'BEHAVIOR_IMPORT_FAILED', // 兜底
  'BEHAVIOR_IMPORT_PERMISSION_DENIED', // 未获 history 权限
  'BEHAVIOR_IMPORT_READ_FAILED', // 读 chrome.history 失败
  'BEHAVIOR_IMPORT_WRITE_FAILED' // 写入 behavior_stats / storage 失败
])

export type BehaviorHistoryImportErrorCode = z.infer<typeof BehaviorHistoryImportErrorCodeSchema>

export const BehaviorHistoryImportStateSchema = z.object({
  status: z.enum([
    'pending', // 待开始
    'running', // 进行中
    'completed', // 已完成
    'failed' // 失败
  ]),
  /** 已写入（upsert）的网址条数 */
  importedCount: z.number().int().nonnegative().default(0),
  /** 单条失败跳过计数 */
  skippedCount: z.number().int().nonnegative().default(0),
  /** 已扫描的 history 条数（进度用） */
  scannedCount: z.number().int().nonnegative().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  errorCode: BehaviorHistoryImportErrorCodeSchema.optional(),
  /** 调试用；UI 不得作为主文案 */
  error: z.string().optional()
})

export type BehaviorHistoryImportState = z.infer<typeof BehaviorHistoryImportStateSchema>
