/**
 * 扩展 vs 官网账号是否「真实异账号」冲突（UI 提示用）。
 * 匿名会话是可接通占位，不算异账号；真实异账号仍报冲突。
 */

export function isWebsiteAccountMismatch(input: {
  /** 扩展侧已有 binding + 凭证（含匿名试用） */
  extensionSignedIn: boolean
  /** 扩展 AccountBinding.accountId */
  extensionAccountId: string | null | undefined
  /** 官网 UI 桥 userId；未登录则为空 */
  websiteUserId: string | null | undefined
  /** 扩展当前为匿名占位会话 */
  isAnonymous?: boolean
}): boolean {
  if (!input.extensionSignedIn) {
    return false
  }
  // AN5：匿名占位可 Connect 升级，不当异账号拦
  if (input.isAnonymous === true) {
    return false
  }
  const extensionId = input.extensionAccountId?.trim()
  if (!extensionId) {
    return false
  }
  const websiteId = input.websiteUserId?.trim()
  if (!websiteId) {
    return false
  }
  return websiteId !== extensionId
}
