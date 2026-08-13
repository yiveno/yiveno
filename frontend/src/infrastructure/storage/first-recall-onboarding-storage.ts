/**
 * 首次找回引导相关 storage（Popup / 划词浮层共用）。
 * session：预填线索；local：摘录次数与是否已完成首次打开结果。
 */

import { markInstallOnboardingDone } from '@/infrastructure/storage/install-onboarding-storage'

export const POPUP_RECALL_PREFILL_SESSION_KEY = 'yiveno.popupRecallPrefill'
export const EXCERPT_CAPTURE_COUNT_LOCAL_KEY = 'yiveno.excerptCaptureCount'
export const FIRST_RECALL_OPEN_DONE_LOCAL_KEY = 'yiveno.firstRecallOpenDone'

/** 写入 Popup 打开时要预填的线索（覆盖旧值）。 */
export async function writePopupRecallPrefill(clue: string): Promise<void> {
  const trimmed = clue.trim()
  if (!trimmed) {
    await chrome.storage.session.remove(POPUP_RECALL_PREFILL_SESSION_KEY)
    return
  }
  await chrome.storage.session.set({ [POPUP_RECALL_PREFILL_SESSION_KEY]: trimmed })
}

/** 读取并清除预填线索（只消费一次）。 */
export async function consumePopupRecallPrefill(): Promise<string | null> {
  const result = await chrome.storage.session.get(POPUP_RECALL_PREFILL_SESSION_KEY)
  const value = result[POPUP_RECALL_PREFILL_SESSION_KEY]
  await chrome.storage.session.remove(POPUP_RECALL_PREFILL_SESSION_KEY)
  return typeof value === 'string' && value.trim() ? value.trim() : null
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

/** 是否已完成至少一次从找回打开结果。 */
export async function readFirstRecallOpenDone(): Promise<boolean> {
  const result = await chrome.storage.local.get(FIRST_RECALL_OPEN_DONE_LOCAL_KEY)
  return result[FIRST_RECALL_OPEN_DONE_LOCAL_KEY] === true
}

/** 标记已完成首次找回打开（同时结束安装引导）。 */
export async function markFirstRecallOpenDone(): Promise<void> {
  await chrome.storage.local.set({ [FIRST_RECALL_OPEN_DONE_LOCAL_KEY]: true })
  await markInstallOnboardingDone()
}
