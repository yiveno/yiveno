/**
 * 临时更新扩展工具栏 badge，标识一次性操作结果。
 * 仅 Background / Service Worker 调用。
 */

export type ActionBadgeResult = 'success' | 'error'

export interface FlashActionBadgeOptions {
  /** 展示时长（毫秒）。 */
  durationMs?: number
}

const DEFAULT_DURATION_MS: Record<ActionBadgeResult, number> = {
  success: 1600,
  error: 2000
}

const BADGE_TEXT: Record<ActionBadgeResult, string> = {
  /** 成功用 +1：表达「又收进一件」，而非勾选完成。角标仅支持短文本，非图片/SVG。 */
  success: '+1',
  error: '!'
}

const BADGE_COLOR: Record<ActionBadgeResult, string> = {
  success: '#0f766e',
  error: '#b42318'
}

let clearTimer: ReturnType<typeof setTimeout> | null = null

function clearPendingTimer(): void {
  if (clearTimer !== null) {
    clearTimeout(clearTimer)
    clearTimer = null
  }
}

/** 清除工具栏 badge。 */
export async function clearActionBadge(): Promise<void> {
  clearPendingTimer()
  await chrome.action.setBadgeText({ text: '' })
}

/**
 * 短暂显示成功/失败 badge，到期自动清除。
 * 连续调用会取消上一次的清除计时。
 */
export async function flashActionBadge(
  result: ActionBadgeResult,
  options: FlashActionBadgeOptions = {}
): Promise<void> {
  clearPendingTimer()

  const durationMs = options.durationMs ?? DEFAULT_DURATION_MS[result]

  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR[result] })
  await chrome.action.setBadgeText({ text: BADGE_TEXT[result] })

  clearTimer = setTimeout(() => {
    clearTimer = null
    void chrome.action.setBadgeText({ text: '' })
  }, durationMs)
}

/** 测试用：重置内部计时器状态。 */
export function resetActionBadgeStateForTests(): void {
  clearPendingTimer()
}
