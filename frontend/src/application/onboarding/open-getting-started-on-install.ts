import { shouldOpenGettingStartedOnInstall } from '@/core/capture/install-onboarding'
import { readInstallOnboardingDone } from '@/infrastructure/storage/install-onboarding-storage'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

/**
 * 扩展首次安装时打开 Getting Started 页，引导 Capture → Recall 闭环。
 */
export async function openGettingStartedOnInstall(reason: string): Promise<void> {
  if (!shouldOpenGettingStartedOnInstall(reason)) {
    return
  }

  const startedAt = flowStart('Onboarding', '安装后打开引导页', { reason })

  try {
    if (await readInstallOnboardingDone()) {
      flowOk('Onboarding', '安装后打开引导页', startedAt, { skipped: true, cause: 'already_done' })
      return
    }

    await chrome.tabs.create({ url: chrome.runtime.getURL('getting-started.html') })
    flowOk('Onboarding', '安装后打开引导页', startedAt, { opened: true })
  } catch (error) {
    flowFail('Onboarding', '安装后打开引导页', startedAt, error)
  }
}
