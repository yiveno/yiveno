/**
 * Recall 整轮失败时的 UI 文案分流（诚实归因 · 离线 vs 在线）。
 * 从 SidePanel 抽出纯函数，便于单测覆盖 CDP 活测难触发的 RECALL_FAILED 分支。
 */

/** !ok 响应：仅 `RECALL_FAILED` + 离线 → 离线文案；其余走 errorCode 映射。 */
export function resolveRecallFailedResponseCopy(input: {
  errorCode: string | undefined
  browserOnline: boolean
  offlineMessage: string
  mappedErrorMessage: string
}): string {
  if (input.errorCode === 'RECALL_FAILED' && !input.browserOnline) {
    return input.offlineMessage
  }
  return input.mappedErrorMessage
}

/** catch（sendMessage 抛错）路径：在线 → 通用失败；离线 → 离线文案。 */
export function resolveRecallThrownCopy(input: {
  browserOnline: boolean
  offlineMessage: string
  onlineFailedMessage: string
}): string {
  return input.browserOnline ? input.onlineFailedMessage : input.offlineMessage
}
