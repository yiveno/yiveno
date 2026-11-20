/**
 * Settings：是否展示匿名试用 Turnstile 前景重试入口。
 * captcha 失败时无 device session（signedIn=false）；isAnonymous 仅在已建成匿名会话时为 true。
 */

export function shouldShowAnonymousCaptchaRetry(state: {
  signedIn: boolean
  isAnonymous?: boolean
  anonymousCaptchaRetryNeeded: boolean
}): boolean {
  if (!state.anonymousCaptchaRetryNeeded) {
    return false
  }
  // 未建成会话：匿名试用 fail-open 主路径
  if (!state.signedIn) {
    return true
  }
  // 已登录且为匿名（防御：仍标需重试时可见）
  return state.isAnonymous === true
}
