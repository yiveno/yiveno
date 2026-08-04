/**
 * 业务流日志约定辅助：开始 / 完成 / 失败，便于 SW 控制台按 scope 过滤。
 * 新增业务路径应优先用本模块，避免只打 error、没有进度。
 */

import { logger } from '@/infrastructure/logging/logger'

function durationMs(startedAt: number): number {
  return Date.now() - startedAt
}

/** 业务步骤开始。 */
export function flowStart(scope: string, action: string, data?: Record<string, unknown>): number {
  logger.info(scope, `${action}：开始`, data)
  return Date.now()
}

/** 业务步骤成功结束。 */
export function flowOk(
  scope: string,
  action: string,
  startedAt: number,
  data?: Record<string, unknown>
): void {
  logger.info(scope, `${action}：完成`, {
    durationMs: durationMs(startedAt),
    ...data
  })
}

/** 业务步骤失败（已捕获或即将返回错误响应）。 */
export function flowFail(
  scope: string,
  action: string,
  startedAt: number,
  error: unknown,
  data?: Record<string, unknown>
): void {
  logger.error(scope, `${action}：失败`, {
    durationMs: durationMs(startedAt),
    error: formatFlowError(error),
    ...data
  })
}

/** 把 Error / 未知值收成可 JSON 预览的结构，避免控制台只见 [object Object]。 */
function formatFlowError(error: unknown): Record<string, unknown> | string {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    }
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    return {
      ...(typeof record.name === 'string' ? { name: record.name } : {}),
      ...(typeof record.message === 'string' ? { message: record.message } : {}),
      ...(typeof record.code === 'string' ? { code: record.code } : {}),
      ...(typeof record.status === 'number' ? { status: record.status } : {})
    }
  }
  return String(error)
}

/** 截断长文本，避免控制台刷屏。 */
export function previewText(value: string, max = 80): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) {
    return trimmed
  }
  return `${trimmed.slice(0, max)}…`
}
