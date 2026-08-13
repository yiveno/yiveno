import {
  normalizeExtensionCommand,
  CHROME_EXTENSION_SHORTCUTS_URL
} from '@/core/commands/command-display'
import type {
  GetExtensionCommandsResponse,
  OpenChromeShortcutsPageResponse,
  OpenRecallPopupResponse
} from '@/core/messaging/commands-messages'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

/** 读取扩展命令与当前快捷键。 */
export async function handleGetExtensionCommands(): Promise<GetExtensionCommandsResponse> {
  try {
    const rawCommands = await chrome.commands.getAll()
    const commands = rawCommands
      .map(normalizeExtensionCommand)
      .filter((command): command is NonNullable<typeof command> => command !== null)

    return { ok: true, commands }
  } catch (error) {
    logger.error('Commands', '读取快捷键失败', error)
    return {
      ok: false,
      errorCode: 'COMMANDS_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** 打开 Chrome 原生快捷键设置页。 */
export async function handleOpenChromeShortcutsPage(): Promise<OpenChromeShortcutsPageResponse> {
  try {
    await chrome.tabs.create({ url: CHROME_EXTENSION_SHORTCUTS_URL })
    return { ok: true }
  } catch (error) {
    logger.error('Commands', '打开快捷键设置页失败', error)
    return {
      ok: false,
      errorCode: 'SHORTCUTS_PAGE_OPEN_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** 在用户手势链上打开 Recall Popup。 */
export async function handleOpenRecallPopup(): Promise<OpenRecallPopupResponse> {
  const startedAt = flowStart('Recall', '打开 Popup')
  try {
    await chrome.action.openPopup()
    flowOk('Recall', '打开 Popup', startedAt, { ok: true })
    return { ok: true }
  } catch (error) {
    flowFail('Recall', '打开 Popup', startedAt, error)
    logger.warn('Commands', '打开 Recall Popup 失败', error)
    return {
      ok: false,
      errorCode: 'RECALL_POPUP_OPEN_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}
