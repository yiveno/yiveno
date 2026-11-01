import {
  normalizeExtensionCommand,
  getExtensionShortcutsSettingsUrl
} from '@/core/commands/command-display'
import type {
  GetExtensionCommandsResponse,
  NavigateActiveTabPayload,
  NavigateActiveTabResponse,
  OpenChromeShortcutsPageResponse,
  OpenRecallShellPayload,
  OpenRecallShellResponse
} from '@/core/messaging/commands-messages'
import { navigateTabToUrl } from '@/infrastructure/browser/navigate-tab'
import {
  openRecallSidePanel,
  type OpenRecallSidePanelOptions
} from '@/infrastructure/browser/side-panel'
import { resolveRecallShellHandoff } from '@/core/recall/recall-shell-handoff'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'
import { writeRecallPrefill } from '@/infrastructure/storage/first-recall-onboarding-storage'

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

/**
 * 在用户手势链上打开 Recall Side Panel；可选附带预填 clue。
 * 有 clue 时：先开火开壳，再写 session（对齐 Omnibox）；开壳失败但预填已写 → 仍 ok（Panel 多半已开，storage 监听会吃）。
 */
export async function handleOpenRecallShell(
  options: OpenRecallSidePanelOptions = {},
  prefill?: OpenRecallShellPayload
): Promise<OpenRecallShellResponse> {
  const startedAt = flowStart('Recall', '打开 Side Panel')
  const clue = prefill?.clue?.trim() ?? ''

  if (!clue) {
    try {
      await openRecallSidePanel(options)
      flowOk('Recall', '打开 Side Panel', startedAt, { ok: true, wrotePrefill: false })
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

  const autoSubmit = prefill?.autoSubmit !== false
  const handoff = await resolveRecallShellHandoff({
    openShell: async () => {
      try {
        await openRecallSidePanel(options)
        return { ok: true }
      } catch (error) {
        logger.warn('Commands', 'sidePanel.open 失败（可能 Panel 已开）', error)
        return { ok: false }
      }
    },
    writePrefill: () => writeRecallPrefill(clue, { autoSubmit })
  })

  if (handoff === 'failed') {
    const err = new Error('开壳与预填均失败')
    flowFail('Recall', '打开 Side Panel', startedAt, err)
    return { ok: false, errorCode: 'RECALL_SHELL_OPEN_FAILED', error: err.message }
  }

  flowOk('Recall', '打开 Side Panel', startedAt, {
    ok: true,
    handoff,
    wrotePrefill: true,
    autoSubmit
  })
  return { ok: true }
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
