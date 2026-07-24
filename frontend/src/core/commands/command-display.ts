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
export function getExtensionCommandDisplayTitle(command: {
  name: string
  description: string
}): string {
  if (command.name === '_execute_action') {
    return '打开找回（Popup）'
  }
  if (command.description && command.description !== command.name) {
    return command.description
  }
  return command.name
}

/** 快捷键展示；未绑定时给出明确文案。 */
export function formatExtensionCommandShortcut(shortcut: string): string {
  const trimmed = shortcut.trim()
  return trimmed.length > 0 ? trimmed : '未设置'
}
