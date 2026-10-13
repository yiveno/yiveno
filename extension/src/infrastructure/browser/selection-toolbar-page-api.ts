import type {
  ContentSelectionCommandResponse,
  SelectionToolbarCommandType
} from '@/core/messaging/content-messages'

export type SelectionToolbarPageApiInvokeResult = ContentSelectionCommandResponse & {
  missingApi?: boolean
}

/**
 * 在扩展 isolated world 内调用划词页 API。
 * 必须自包含、无外部运行时依赖（供 chrome.scripting.executeScript 序列化）。
 */
export async function invokeSelectionToolbarPageApi(
  commandType: SelectionToolbarCommandType,
  apiKey: string
): Promise<SelectionToolbarPageApiInvokeResult> {
  const holder = globalThis as Record<string, unknown>
  const api = holder[apiKey] as
    | {
        runCommand?: (type: SelectionToolbarCommandType) => Promise<ContentSelectionCommandResponse>
      }
    | undefined

  if (!api || typeof api.runCommand !== 'function') {
    return { ok: false, errorCode: 'SELECTION_COMMAND_FAILED', missingApi: true }
  }

  return api.runCommand(commandType)
}
