import {
  dispatchExtensionCommand,
  registerExtensionCommandHandler
} from '@/background/commands/registry'
import { flashActionBadge } from '@/infrastructure/browser/action-badge'
import {
  focusOrOpenLibraryTab,
  focusOrOpenSettingsTab
} from '@/infrastructure/browser/extension-tab'
import { dispatchSelectionToolbarCommand } from '@/infrastructure/browser/selection-toolbar-command'
import { logger } from '@/infrastructure/logging/logger'

let listenersRegistered = false

/**
 * 注册自定义命令处理器与 chrome.commands.onCommand 监听。
 * `_execute_action` / 工具栏点击由 `ensureSidePanelOpensOnActionClick` 打开 Side Panel，不进入本 `onCommand` 路径。
 * 书签写入靠 Chrome 原生书签 + sync 监听，不提供「保存当前页」快捷键。
 */
export function registerCommandListeners(): void {
  if (listenersRegistered) {
    return
  }
  listenersRegistered = true

  registerExtensionCommandHandler('open_library', async () => {
    await focusOrOpenLibraryTab()
  })

  registerExtensionCommandHandler('open_settings', async () => {
    await focusOrOpenSettingsTab()
  })

  registerExtensionCommandHandler('save_selection', async () => {
    const result = await dispatchSelectionToolbarCommand('SELECTION_SAVE')
    // ignored：无选区等，静默；no_receiver：无法到达划词脚本
    if (result.status === 'no_receiver') {
      await flashActionBadge('error')
    }
  })

  registerExtensionCommandHandler('save_selection_with_note', async () => {
    const result = await dispatchSelectionToolbarCommand('SELECTION_OPEN_NOTE')
    if (result.status === 'no_receiver') {
      await flashActionBadge('error')
    }
  })

  chrome.commands.onCommand.addListener(command => {
    void dispatchExtensionCommand(command).catch(error => {
      logger.error('Commands', '命令分发失败', error)
    })
  })

  logger.info('Commands', '快捷键命令监听器已注册')
}

/** 测试用：重置监听器注册状态。 */
export function resetCommandListenersForTests(): void {
  listenersRegistered = false
}
