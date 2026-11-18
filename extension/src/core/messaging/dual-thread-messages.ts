/**
 * 暗线同意：学习记录读取 / 贡献上传触发 / 删除已贡献汇总（ADR-027）。
 */

import type { BackgroundMessageScope } from '@/core/messaging/constants'
import type { DualThreadAggregateSketch } from '@/core/recall/dual-thread/dual-thread-aggregate'
import type {
  DualThreadContributeBlockReason,
  DualThreadSketchUploadState
} from '@/core/recall/dual-thread/dual-thread-consent'
import { z } from 'zod'

/** 暗线消息稳定错误码。 */
export const DualThreadErrorCodeSchema = z.enum([
  'DUAL_THREAD_STATUS_FAILED', // 读取学习/贡献状态失败
  'DUAL_THREAD_DELETE_AUTH_REQUIRED', // 删除已贡献汇总须登录
  'DUAL_THREAD_DELETE_FAILED', // 删除请求失败
  'DUAL_THREAD_UPLOAD_TRIGGER_FAILED' // 触发上传检查失败（不挡 Recall）
])

export type DualThreadErrorCode = z.infer<typeof DualThreadErrorCodeSchema>

/** 读取本地学习草图 + 贡献状态（打开 privacy 分区时）。 */
export type GetDualThreadLearningStatusMessage = {
  scope: BackgroundMessageScope
  type: 'GET_DUAL_THREAD_LEARNING_STATUS'
}

export type GetDualThreadLearningStatusResponse =
  | {
      ok: true
      localLearningEnabled: boolean
      contributeEnabled: boolean
      signedIn: boolean
      contributeBlockReason: DualThreadContributeBlockReason
      /** 仅本地学习开时有草图；否则 null */
      sketch: DualThreadAggregateSketch | null
      uploadState: DualThreadSketchUploadState
    }
  | {
      ok: false
      errorCode: DualThreadErrorCode
      error?: string
    }

/** 删除该账号已贡献的全部匿名汇总。 */
export type DeleteDualThreadContributedSketchesMessage = {
  scope: BackgroundMessageScope
  type: 'DELETE_DUAL_THREAD_CONTRIBUTED_SKETCHES'
}

export type DeleteDualThreadContributedSketchesResponse =
  | {
      ok: true
      deletedCount: number
    }
  | {
      ok: false
      errorCode: DualThreadErrorCode
      error?: string
    }

/**
 * 扩展启动 / Side Panel 打开：按门禁尝试上传一次（失败静默）。
 * 不挡 Recall。
 */
export type MaybeUploadDualThreadSketchMessage = {
  scope: BackgroundMessageScope
  type: 'MAYBE_UPLOAD_DUAL_THREAD_SKETCH'
}

export type MaybeUploadDualThreadSketchResponse =
  | {
      ok: true
      attempted: boolean
      uploaded: boolean
    }
  | {
      ok: false
      errorCode: DualThreadErrorCode
      error?: string
    }

export type DualThreadBackgroundMessage =
  | GetDualThreadLearningStatusMessage
  | DeleteDualThreadContributedSketchesMessage
  | MaybeUploadDualThreadSketchMessage

export type DualThreadBackgroundResponse =
  | GetDualThreadLearningStatusResponse
  | DeleteDualThreadContributedSketchesResponse
  | MaybeUploadDualThreadSketchResponse
