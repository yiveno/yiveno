/**
 * 暗线同意：本地学习 / 贡献匿名汇总的门禁与展示纯函数（ADR-027）。
 * 不碰遥测录制；不改适应旋钮。
 */

import type { DualThreadAggregateSketch } from '@/core/recall/dual-thread/dual-thread-aggregate'

/** 贡献开关禁用原因（Settings 状态行）。 */
export type DualThreadContributeBlockReason =
  | 'need_local_learning' // 未开本地学习
  | 'need_sign_in' // 未登录
  | null // 可用

/** 上传状态机输入。 */
export type DualThreadSketchUploadState = {
  /** 上次成功上传 ISO；从未成功则为 null */
  lastSuccessAtIso: string | null
  /** 最近一次尝试是否失败（成功后清 false） */
  lastAttemptFailed: boolean
}

const UPLOAD_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * 开关 2（贡献）UI 是否可用：须本地学习开且已登录。
 * 优先返回 need_local_learning（本地学习是前置）。
 */
export function resolveDualThreadContributeBlockReason(input: {
  localLearningEnabled: boolean
  signedIn: boolean
}): DualThreadContributeBlockReason {
  if (!input.localLearningEnabled) return 'need_local_learning'
  if (!input.signedIn) return 'need_sign_in'
  return null
}

/** 是否应尝试上传（设置开 + 已登录 + 距上次成功 ≥ 24h）。 */
export function shouldAttemptDualThreadSketchUpload(input: {
  localLearningEnabled: boolean
  contributeEnabled: boolean
  hasAccessToken: boolean
  lastSuccessAtIso: string | null
  nowMs: number
}): boolean {
  if (!input.localLearningEnabled || !input.contributeEnabled || !input.hasAccessToken) {
    return false
  }
  if (!input.lastSuccessAtIso) return true
  const lastMs = Date.parse(input.lastSuccessAtIso)
  if (Number.isNaN(lastMs)) return true
  return input.nowMs - lastMs >= UPLOAD_MIN_INTERVAL_MS
}

/** 失败环节计数是否全零（展示「暂无归因」而非一排 0）。 */
export function hasAnyFailureStageCounts(
  counts: DualThreadAggregateSketch['failureStageCounts']
): boolean {
  return Object.values(counts).some(n => n > 0)
}

/** 本地日历日键 YYYY-MM-DD（按用户时区）。 */
export function localCalendarDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 上次贡献展示档：失败优先；否则从未 / 今天 / 昨天 / ISO 短日期。
 */
export function resolveDualThreadContributionDisplay(input: {
  state: DualThreadSketchUploadState
  now: Date
}):
  | { kind: 'failed' }
  | { kind: 'never' }
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'date'; isoDate: string } {
  if (input.state.lastAttemptFailed) {
    return { kind: 'failed' }
  }
  const iso = input.state.lastSuccessAtIso
  if (!iso) {
    return { kind: 'never' }
  }
  const successAt = new Date(iso)
  if (Number.isNaN(successAt.getTime())) {
    return { kind: 'never' }
  }
  const successDay = localCalendarDayKey(successAt)
  const today = localCalendarDayKey(input.now)
  if (successDay === today) {
    return { kind: 'today' }
  }
  const yesterday = new Date(input.now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (successDay === localCalendarDayKey(yesterday)) {
    return { kind: 'yesterday' }
  }
  return { kind: 'date', isoDate: successDay }
}
