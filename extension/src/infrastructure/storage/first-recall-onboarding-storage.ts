/**
 * 首次找回引导相关 storage（Side Panel / 划词浮层共用）。
 * session：预填线索；local：摘录次数与是否已完成首次打开结果。
 */

import { markInstallOnboardingDone } from '@/infrastructure/storage/install-onboarding-storage'

/** 找回主壳打开时消费的预填线索。 */
export const RECALL_PREFILL_SESSION_KEY = 'yiveno.recallPrefill'
/** 旧 Popup 预填键（consume 时兼容一次，写时清掉）。 */
const LEGACY_POPUP_RECALL_PREFILL_SESSION_KEY = 'yiveno.popupRecallPrefill'

export const EXCERPT_CAPTURE_COUNT_LOCAL_KEY = 'yiveno.excerptCaptureCount'
export const FIRST_RECALL_OPEN_DONE_LOCAL_KEY = 'yiveno.firstRecallOpenDone'

/** 写入 Side Panel 打开时要预填的线索（覆盖旧值）。 */
export async function writeRecallPrefill(clue: string): Promise<void> {
  const trimmed = clue.trim()
  if (!trimmed) {
    await chrome.storage.session.remove([
      RECALL_PREFILL_SESSION_KEY,
      LEGACY_POPUP_RECALL_PREFILL_SESSION_KEY
    ])
    return
  }
  await chrome.storage.session.set({ [RECALL_PREFILL_SESSION_KEY]: trimmed })
  await chrome.storage.session.remove(LEGACY_POPUP_RECALL_PREFILL_SESSION_KEY)
}

/** 读取并清除预填线索（只消费一次；兼容旧 popup 键）。 */
export async function consumeRecallPrefill(): Promise<string | null> {
  const result = await chrome.storage.session.get([
    RECALL_PREFILL_SESSION_KEY,
    LEGACY_POPUP_RECALL_PREFILL_SESSION_KEY
  ])
  const primary = result[RECALL_PREFILL_SESSION_KEY]
  const legacy = result[LEGACY_POPUP_RECALL_PREFILL_SESSION_KEY]
  await chrome.storage.session.remove([
    RECALL_PREFILL_SESSION_KEY,
    LEGACY_POPUP_RECALL_PREFILL_SESSION_KEY
  ])
  if (typeof primary === 'string' && primary.trim()) {
    return primary.trim()
  }
  if (typeof legacy === 'string' && legacy.trim()) {
    return legacy.trim()
  }
  return null
}

/**
 * 短窗重试消费预填（Getting Started：开壳手势内不能 await 写 session，写与 Side Panel mount 可能竞态）。
 */
export async function consumeRecallPrefillWithRetry(options?: {
  /** 尝试次数（含首次） */
  attempts?: number
  /** 两次尝试间隔 ms */
  intervalMs?: number
}): Promise<string | null> {
  const attempts = options?.attempts ?? 6
  const intervalMs = options?.intervalMs ?? 50
  for (let i = 0; i < attempts; i += 1) {
    const clue = await consumeRecallPrefill()
    if (clue) {
      return clue
    }
    if (i < attempts - 1) {
      await new Promise<void>(resolve => {
        setTimeout(resolve, intervalMs)
      })
    }
  }
  return null
}

/** 读取摘录 Capture 累计次数。 */
export async function readExcerptCaptureCount(): Promise<number> {
  const result = await chrome.storage.local.get(EXCERPT_CAPTURE_COUNT_LOCAL_KEY)
  const value = result[EXCERPT_CAPTURE_COUNT_LOCAL_KEY]
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

/** 摘录存成后 +1，返回新计数。 */
export async function bumpExcerptCaptureCount(): Promise<number> {
  const next = (await readExcerptCaptureCount()) + 1
  await chrome.storage.local.set({ [EXCERPT_CAPTURE_COUNT_LOCAL_KEY]: next })
  return next
}

/** 是否已完成至少一次成功找回（邻域出现或打开过结果）。 */
export async function readFirstRecallOpenDone(): Promise<boolean> {
  const result = await chrome.storage.local.get(FIRST_RECALL_OPEN_DONE_LOCAL_KEY)
  return result[FIRST_RECALL_OPEN_DONE_LOCAL_KEY] === true
}

/**
 * 标记首次成功找回（同时结束安装引导）。
 * 触发点：邻域 `top_pick` 出现，或用户打开结果卡。
 */
export async function markFirstRecallOpenDone(): Promise<void> {
  await chrome.storage.local.set({ [FIRST_RECALL_OPEN_DONE_LOCAL_KEY]: true })
  await markInstallOnboardingDone()
}
