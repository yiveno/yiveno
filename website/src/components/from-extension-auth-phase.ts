/**
 * 扩展 → 官网反向接通：加载时决策（纯函数，便于单测）。
 * 同账号短路 / 未登录自动铸会话 / 不同账号确认；**不**在此触发铸会话（触发仍在组件）。
 */

export type FromExtensionAuthPhase =
  | 'redirect_same' // 同账号 → 直接进 next，不铸会话
  | 'auto_sign_in' // 官网未登录 → 加载即自动铸会话
  | 'confirm_switch' // 官网已登录且账号不同
  | 'error_missing_extension'
  | 'error_extension_unsigned'

export function decideFromExtensionAuthPhase(input: {
  extensionId: string
  extensionSignedIn: boolean
  extensionUserId: string
  websiteUserId: string
}): FromExtensionAuthPhase {
  if (!input.extensionId.trim()) {
    return 'error_missing_extension'
  }
  if (!input.extensionSignedIn || !input.extensionUserId.trim()) {
    return 'error_extension_unsigned'
  }
  const websiteId = input.websiteUserId.trim()
  if (websiteId && websiteId === input.extensionUserId.trim()) {
    return 'redirect_same'
  }
  if (!websiteId) {
    return 'auto_sign_in'
  }
  return 'confirm_switch'
}
