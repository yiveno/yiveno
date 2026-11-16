/**
 * 安装引导完成标记（Side Panel / Getting Started 共用）。
 */

export const INSTALL_ONBOARDING_DONE_LOCAL_KEY = 'yiveno.installOnboardingDone'

/** Getting Started：书签同步建议卡「不用了」持久标记。 */
export const CHROME_BOOKMARK_SYNC_SUGGESTION_DISMISSED_LOCAL_KEY =
  'yiveno.chromeBookmarkSyncSuggestionDismissed'

/** 是否已完成或跳过安装引导。 */
export async function readInstallOnboardingDone(): Promise<boolean> {
  const result = await chrome.storage.local.get(INSTALL_ONBOARDING_DONE_LOCAL_KEY)
  return result[INSTALL_ONBOARDING_DONE_LOCAL_KEY] === true
}

/** 标记安装引导已完成（跳过或走完闭环）。 */
export async function markInstallOnboardingDone(): Promise<void> {
  await chrome.storage.local.set({ [INSTALL_ONBOARDING_DONE_LOCAL_KEY]: true })
}

/** 是否已关掉 GS 书签同步建议卡。 */
export async function readSyncSuggestionDismissed(): Promise<boolean> {
  const result = await chrome.storage.local.get(CHROME_BOOKMARK_SYNC_SUGGESTION_DISMISSED_LOCAL_KEY)
  return result[CHROME_BOOKMARK_SYNC_SUGGESTION_DISMISSED_LOCAL_KEY] === true
}

/** 标记 GS 书签同步建议「不用了」（清本机记忆不清除，与 installOnboardingDone 同策略）。 */
export async function writeSyncSuggestionDismissed(): Promise<void> {
  await chrome.storage.local.set({ [CHROME_BOOKMARK_SYNC_SUGGESTION_DISMISSED_LOCAL_KEY]: true })
}
