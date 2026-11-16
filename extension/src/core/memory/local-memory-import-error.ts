import { z } from 'zod'

/** 本地 Backup 恢复面向 UI 的稳定错误码。 */
export const LocalMemoryImportErrorCodeSchema = z.enum([
  'LOCAL_IMPORT_INVALID_FORMAT', // JSON / 信封形状非法
  'LOCAL_IMPORT_UNSUPPORTED_VERSION', // formatVersion > 1
  'LOCAL_IMPORT_EMPTY', // 0 条目且 0 命题
  'LOCAL_IMPORT_IN_PROGRESS', // 已有恢复在进行
  'LOCAL_IMPORT_FAILED' // 其它失败
])

export type LocalMemoryImportErrorCode = z.infer<typeof LocalMemoryImportErrorCodeSchema>
