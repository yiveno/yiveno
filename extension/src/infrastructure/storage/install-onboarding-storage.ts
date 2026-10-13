/**
 * 安装引导完成标记（Side Panel / Getting Started 共用）。
 */

export const INSTALL_ONBOARDING_DONE_LOCAL_KEY = 'yiveno.installOnboardingDone'

/** 是否已完成或跳过安装引导。 */
export async function readInstallOnboardingDone(): Promise<boolean> {
  const result = await chrome.storage.local.get(INSTALL_ONBOARDING_DONE_LOCAL_KEY)
  return result[INSTALL_ONBOARDING_DONE_LOCAL_KEY] === true
}

/** 标记安装引导已完成（跳过或走完闭环）。 */
export async function markInstallOnboardingDone(): Promise<void> {
  await chrome.storage.local.set({ [INSTALL_ONBOARDING_DONE_LOCAL_KEY]: true })
}
