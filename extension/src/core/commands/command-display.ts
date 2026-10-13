import type { TranslateFn } from '@/core/i18n/translate'

/** Chrome 扩展快捷键设置页。 */
export const CHROME_EXTENSION_SHORTCUTS_URL = 'chrome://extensions/shortcuts' as const

/** 将 chrome.commands.Command 规范为设置页展示结构。 */
export function normalizeExtensionCommand(command: {
  name?: string
  description?: string
  shortcut?: string
}): { name: string; description: string; shortcut: string } | null {
  const name = command.name?.trim()
  if (!name) {
    return null
  }

  return {
    name,
    description: command.description?.trim() || name,
    shortcut: command.shortcut?.trim() || ''
  }
}

/** 设置页展示用标题（优先产品文案，其次 Chrome description）。 */
export function getExtensionCommandDisplayTitle(
  command: {
    name: string
    description: string
  },
  translate: TranslateFn
): string {
  if (command.name === '_execute_action') {
    return translate('command_title_open_recall')
  }
  if (command.name === 'open_library') {
    return translate('command_title_open_library')
  }
  if (command.name === 'open_settings') {
    return translate('command_title_open_settings')
  }
  if (command.name === 'save_selection') {
    return translate('command_title_save_selection')
  }
  if (command.name === 'save_selection_with_note') {
    return translate('command_title_save_selection_with_note')
  }
  if (command.description && command.description !== command.name) {
    return command.description
  }
  return command.name
}

/** 快捷键展示；未绑定时给出明确文案。 */
export function formatExtensionCommandShortcut(shortcut: string, translate: TranslateFn): string {
  const trimmed = shortcut.trim()
  return trimmed.length > 0 ? trimmed : translate('command_shortcut_unset')
}
