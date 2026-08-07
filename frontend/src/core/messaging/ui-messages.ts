import { z } from 'zod'

/** SW → 扩展页（记忆库等）推送消息 scope。 */
export const UI_MESSAGE_SCOPE = 'ui' as const

export type UiMessageScope = typeof UI_MESSAGE_SCOPE

/**
 * SW 通知：Chrome 书签树已变（增删改移/改名）。
 * 记忆库应重拉 GET_BOOKMARK_LIBRARY_TREE；与 Memory 灌库成败无关。
 */
export type ChromeBookmarkTreeChangedMessage = {
  scope: UiMessageScope
  type: 'CHROME_BOOKMARK_TREE_CHANGED' // Chrome 书签树变更
}

/** SW → UI 推送联合（后续可并入更多热更新消息）。 */
export type UiPushMessage = ChromeBookmarkTreeChangedMessage

const chromeBookmarkTreeChangedSchema = z.object({
  scope: z.literal(UI_MESSAGE_SCOPE),
  type: z.literal('CHROME_BOOKMARK_TREE_CHANGED')
})

/** 解析 SW → UI 书签树变更通知；非法则返回 null。 */
export function parseChromeBookmarkTreeChangedMessage(value: unknown): UiPushMessage | null {
  const parsed = chromeBookmarkTreeChangedSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function isUiScopedMessage(
  value: unknown
): value is { scope: UiMessageScope; type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'scope' in value &&
    (value as { scope: unknown }).scope === UI_MESSAGE_SCOPE
  )
}
