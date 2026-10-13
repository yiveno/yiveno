/**
 * 安装引导状态机（纯函数）。
 * 存储读写见 infrastructure/storage/install-onboarding-storage。
 */

/**
 * Side Panel 是否应展示 Capture-first 空态。
 * 仅当引导未完成且库无可召库存（无书签且无摘录）时；
 * 仅有书签时走普通 Idle，勿误伤书签首召。
 */
export function shouldShowCaptureFirstRecallShell(input: {
  excerptCaptureCount: number
  bookmarkCount: number
  installOnboardingDone: boolean
}): boolean {
  if (input.installOnboardingDone) {
    return false
  }
  return input.excerptCaptureCount === 0 && input.bookmarkCount === 0
}

/** 是否应在扩展安装时打开 Getting Started 页。 */
export function shouldOpenGettingStartedOnInstall(reason: string): boolean {
  return reason === 'install'
}
