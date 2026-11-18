/**
 * 暗线匿名汇总上传状态（chrome.storage.local · 与遥测并列，非遥测本身）。
 */

import type { DualThreadSketchUploadState } from '@/core/recall/dual-thread/dual-thread-consent'

/** 上次贡献上传状态 key（成功时间 + 最近失败标记）。 */
export const DUAL_THREAD_SKETCH_UPLOAD_STATE_KEY = 'yiveno.dualThreadSketchUpload' as const

const DEFAULT_STATE: DualThreadSketchUploadState = {
  lastSuccessAtIso: null,
  lastAttemptFailed: false
}

function parseState(raw: unknown): DualThreadSketchUploadState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STATE }
  }
  const record = raw as Record<string, unknown>
  const lastSuccessAtIso =
    typeof record.lastSuccessAtIso === 'string' && record.lastSuccessAtIso.length > 0
      ? record.lastSuccessAtIso
      : null
  const lastAttemptFailed = record.lastAttemptFailed === true
  return { lastSuccessAtIso, lastAttemptFailed }
}

/** 读取上传状态。 */
export async function readDualThreadSketchUploadState(): Promise<DualThreadSketchUploadState> {
  const bag = await chrome.storage.local.get(DUAL_THREAD_SKETCH_UPLOAD_STATE_KEY)
  return parseState(bag[DUAL_THREAD_SKETCH_UPLOAD_STATE_KEY])
}

/** 写入上传状态。 */
export async function writeDualThreadSketchUploadState(
  state: DualThreadSketchUploadState
): Promise<void> {
  await chrome.storage.local.set({ [DUAL_THREAD_SKETCH_UPLOAD_STATE_KEY]: state })
}

/** 标记上传成功。 */
export async function markDualThreadSketchUploadSuccess(nowIso: string): Promise<void> {
  await writeDualThreadSketchUploadState({
    lastSuccessAtIso: nowIso,
    lastAttemptFailed: false
  })
}

/** 标记上传失败（保留上次成功时间）。 */
export async function markDualThreadSketchUploadFailed(): Promise<void> {
  const current = await readDualThreadSketchUploadState()
  await writeDualThreadSketchUploadState({
    lastSuccessAtIso: current.lastSuccessAtIso,
    lastAttemptFailed: true
  })
}

/** 删除已贡献后：状态归从未。 */
export async function clearDualThreadSketchUploadState(): Promise<void> {
  await writeDualThreadSketchUploadState({ ...DEFAULT_STATE })
}
