/**
 * 暗线同意：学习记录读取、贡献上传、删除已贡献（ADR-027）。
 * 观察 + 展示 + 分享；不改适应旋钮、不挡 Recall。
 */

import { buildDualThreadAggregateSketch } from '@/core/recall/dual-thread/dual-thread-aggregate'
import {
  resolveDualThreadContributeBlockReason,
  shouldAttemptDualThreadSketchUpload
} from '@/core/recall/dual-thread/dual-thread-consent'
import type {
  DeleteDualThreadContributedSketchesResponse,
  GetDualThreadLearningStatusResponse,
  MaybeUploadDualThreadSketchResponse
} from '@/core/messaging/dual-thread-messages'
import { listRecallTelemetryEvents } from '@/infrastructure/analytics/recall-telemetry-store'
import {
  clearDualThreadSketchUploadState,
  markDualThreadSketchUploadFailed,
  markDualThreadSketchUploadSuccess,
  readDualThreadSketchUploadState
} from '@/infrastructure/analytics/dual-thread-sketch-upload-store'
import { getWorkerApiAccessToken } from '@/infrastructure/identity/worker-api-access-token'
import {
  deleteDualThreadResearchSketches,
  postDualThreadResearchSketch
} from '@/infrastructure/messaging/dual-thread-research-api-client'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

function toErrorPayload(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

/** 现场计算草图（与 Settings 展示 / 上传共用）。 */
export async function computeDualThreadLearningSketch() {
  const events = await listRecallTelemetryEvents()
  return buildDualThreadAggregateSketch({ events })
}

/** Settings privacy：学习记录 + 贡献状态。 */
export async function getDualThreadLearningStatus(): Promise<GetDualThreadLearningStatusResponse> {
  const startedAt = flowStart('DualThread', '读取学习/贡献状态')
  try {
    const [settings, uploadState, accessToken] = await Promise.all([
      getUserSettings(),
      readDualThreadSketchUploadState(),
      getWorkerApiAccessToken()
    ])
    const signedIn = Boolean(accessToken)
    const localLearningEnabled = settings.dualThreadLocalLearningEnabled
    const contributeEnabled = settings.dualThreadContributeAggregatesEnabled
    const contributeBlockReason = resolveDualThreadContributeBlockReason({
      localLearningEnabled,
      signedIn
    })
    const sketch = localLearningEnabled ? await computeDualThreadLearningSketch() : null
    flowOk('DualThread', '读取学习/贡献状态', startedAt, {
      localLearningEnabled,
      contributeEnabled,
      signedIn,
      hasSketch: sketch != null,
      telemetryEventCount: sketch?.telemetryEventCount ?? 0
    })
    return {
      ok: true,
      localLearningEnabled,
      contributeEnabled,
      signedIn,
      contributeBlockReason,
      sketch,
      uploadState
    }
  } catch (error) {
    flowFail('DualThread', '读取学习/贡献状态', startedAt, error)
    const debug = toErrorPayload(error)
    return {
      ok: false,
      errorCode: 'DUAL_THREAD_STATUS_FAILED',
      ...(debug ? { error: debug } : {})
    }
  }
}

/**
 * 门禁满足时上传一次；失败只记状态，永不抛到 Recall。
 */
export async function maybeUploadDualThreadSketch(): Promise<MaybeUploadDualThreadSketchResponse> {
  const startedAt = flowStart('DualThread', '检查并上传匿名汇总')
  try {
    const [settings, uploadState, accessToken] = await Promise.all([
      getUserSettings(),
      readDualThreadSketchUploadState(),
      getWorkerApiAccessToken()
    ])
    const nowMs = Date.now()
    const should = shouldAttemptDualThreadSketchUpload({
      localLearningEnabled: settings.dualThreadLocalLearningEnabled,
      contributeEnabled: settings.dualThreadContributeAggregatesEnabled,
      hasAccessToken: Boolean(accessToken),
      lastSuccessAtIso: uploadState.lastSuccessAtIso,
      nowMs
    })
    if (!should || !accessToken) {
      flowOk('DualThread', '检查并上传匿名汇总', startedAt, {
        attempted: false,
        uploaded: false,
        reason: 'gated'
      })
      return { ok: true, attempted: false, uploaded: false }
    }

    try {
      const sketch = await computeDualThreadLearningSketch()
      await postDualThreadResearchSketch(accessToken, sketch)
      const nowIso = new Date(nowMs).toISOString()
      await markDualThreadSketchUploadSuccess(nowIso)
      flowOk('DualThread', '检查并上传匿名汇总', startedAt, {
        attempted: true,
        uploaded: true,
        telemetryEventCount: sketch.telemetryEventCount
      })
      return { ok: true, attempted: true, uploaded: true }
    } catch (uploadError) {
      await markDualThreadSketchUploadFailed().catch(() => {
        // 状态写入失败也不挡
      })
      logger.warn('DualThread', '匿名汇总上传失败（静默，下次再试）', uploadError)
      flowOk('DualThread', '检查并上传匿名汇总', startedAt, {
        attempted: true,
        uploaded: false
      })
      return { ok: true, attempted: true, uploaded: false }
    }
  } catch (error) {
    // 外层失败亦不挡业务；返回 ok:true 以免 UI/启动路径报警
    flowFail('DualThread', '检查并上传匿名汇总', startedAt, error)
    logger.warn('DualThread', '上传检查异常（静默）', error)
    return { ok: true, attempted: false, uploaded: false }
  }
}

/** Settings：删除已贡献汇总。 */
export async function deleteDualThreadContributedSketches(): Promise<DeleteDualThreadContributedSketchesResponse> {
  const startedAt = flowStart('DualThread', '删除已贡献汇总')
  try {
    const accessToken = await getWorkerApiAccessToken()
    if (!accessToken) {
      flowOk('DualThread', '删除已贡献汇总', startedAt, { reason: 'not_signed_in' })
      return { ok: false, errorCode: 'DUAL_THREAD_DELETE_AUTH_REQUIRED' }
    }
    const result = await deleteDualThreadResearchSketches(accessToken)
    await clearDualThreadSketchUploadState()
    flowOk('DualThread', '删除已贡献汇总', startedAt, { deletedCount: result.deletedCount })
    return { ok: true, deletedCount: result.deletedCount }
  } catch (error) {
    flowFail('DualThread', '删除已贡献汇总', startedAt, error)
    const debug = toErrorPayload(error)
    return {
      ok: false,
      errorCode: 'DUAL_THREAD_DELETE_FAILED',
      ...(debug ? { error: debug } : {})
    }
  }
}
