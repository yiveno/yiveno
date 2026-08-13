/**
 * 安装引导状态机（纯函数）。
 * 存储读写见 infrastructure/storage/install-onboarding-storage。
 */

/** Popup 是否应展示 Capture-first 空态（即使书签已导入）。 */
export function shouldShowCaptureFirstPopup(input: {
  excerptCaptureCount: number
  installOnboardingDone: boolean
}): boolean {
  if (input.installOnboardingDone) {
    return false
  }
  return input.excerptCaptureCount === 0
}

/** 是否应在扩展安装时打开 Getting Started 页。 */
export function shouldOpenGettingStartedOnInstall(reason: string): boolean {
  return reason === 'install'
}
