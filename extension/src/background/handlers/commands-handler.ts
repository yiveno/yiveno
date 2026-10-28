import {
  normalizeExtensionCommand,
  getExtensionShortcutsSettingsUrl
} from '@/core/commands/command-display'
import type {
  GetExtensionCommandsResponse,
  NavigateActiveTabPayload,
  NavigateActiveTabResponse,
  OpenChromeShortcutsPageResponse,
  OpenRecallShellResponse
} from '@/core/messaging/commands-messages'
import { navigateTabToUrl } from '@/infrastructure/browser/navigate-tab'
import {
  openRecallSidePanel,
  type OpenRecallSidePanelOptions
} from '@/infrastructure/browser/side-panel'
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

/** 打开本浏览器原生快捷键设置页（Chrome / Edge）。 */
export async function handleOpenChromeShortcutsPage(): Promise<OpenChromeShortcutsPageResponse> {
  try {
    const url = getExtensionShortcutsSettingsUrl()
    await chrome.tabs.create({ url })
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

/** 在用户手势链上打开 Recall Side Panel。 */
export async function handleOpenRecallShell(
  options: OpenRecallSidePanelOptions = {}
): Promise<OpenRecallShellResponse> {
  const startedAt = flowStart('Recall', '打开 Side Panel')
  try {
    await openRecallSidePanel(options)
    flowOk('Recall', '打开 Side Panel', startedAt, { ok: true })
    return { ok: true }
  } catch (error) {
    flowFail('Recall', '打开 Side Panel', startedAt, error)
    logger.warn('Commands', '打开 Recall Side Panel 失败', error)
    return {
      ok: false,
      errorCode: 'RECALL_SHELL_OPEN_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** Side Panel 等：在活动标签（或新标签）打开可导航 URL。 */
export async function handleNavigateActiveTab(
  payload: NavigateActiveTabPayload
): Promise<NavigateActiveTabResponse> {
  const disposition = payload.disposition ?? 'currentTab'
  const startedAt = flowStart('Nav', '标签导航', { disposition })
  try {
    await navigateTabToUrl(payload.url, disposition)
    flowOk('Nav', '标签导航', startedAt, { disposition, ok: true })
    return { ok: true }
  } catch (error) {
    flowFail('Nav', '标签导航', startedAt, error, { disposition })
    logger.warn('Commands', '标签导航失败', error)
    return {
      ok: false,
      errorCode: 'NAVIGATE_TAB_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}
