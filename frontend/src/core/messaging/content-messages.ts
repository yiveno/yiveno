import { z } from 'zod'

/** Content Script 消息 scope（与 Background 的 `background` 区分）。 */
export const CONTENT_MESSAGE_SCOPE = 'content' as const

export type ContentMessageScope = typeof CONTENT_MESSAGE_SCOPE

/**
 * 划词脚本挂在 isolated world `globalThis` 上的快捷键 API 键名。
 * SW 经 `scripting.executeScript` 调用（比 tabs.sendMessage 在程序注入后更可靠）。
 */
export const SELECTION_TOOLBAR_PAGE_API_KEY = '__yivenoSelectionToolbarApi' as const

export type SelectionToolbarCommandType = 'SELECTION_SAVE' | 'SELECTION_OPEN_NOTE'

const contentSelectionCommandSchema = z.object({
  scope: z.literal(CONTENT_MESSAGE_SCOPE),
  type: z.enum(['SELECTION_SAVE', 'SELECTION_OPEN_NOTE'])
})

/** SW → 划词浮层：快捷键触发保存 / 打开备注面板。 */
export type ContentSelectionCommandMessage = z.infer<typeof contentSelectionCommandSchema>

export type ContentSelectionCommandSuccessResponse = {
  ok: true
  /** 无选区等：已忽略，调用方勿当失败提示 */
  skipped?: true
}

export type ContentSelectionCommandErrorResponse = {
  ok: false
  errorCode: 'CAPTURE_EMPTY_SELECTION' | 'CAPTURE_UNSAVABLE_PAGE' | 'SELECTION_COMMAND_FAILED'
}

export type ContentSelectionCommandResponse =
  | ContentSelectionCommandSuccessResponse
  | ContentSelectionCommandErrorResponse

/** 页内 API：供 SW executeScript 调用。 */
export type SelectionToolbarPageApi = {
  runCommand: (type: SelectionToolbarCommandType) => Promise<ContentSelectionCommandResponse>
}

export function parseContentSelectionCommandMessage(
  value: unknown
): ContentSelectionCommandMessage | null {
  const parsed = contentSelectionCommandSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function isContentScopedMessage(
  value: unknown
): value is { scope: ContentMessageScope; type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'scope' in value &&
    (value as { scope: unknown }).scope === CONTENT_MESSAGE_SCOPE
  )
}
