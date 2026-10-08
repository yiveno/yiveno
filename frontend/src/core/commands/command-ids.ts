/**
 * Chrome 保留命令：工具栏 action / 建议键打开 Side Panel。
 * 不在 `EXTENSION_COMMAND_IDS` 内（不走 `onCommand`）；读真实绑定时用此名查 `chrome.commands.getAll()`。
 */
export const OPEN_RECALL_ACTION_COMMAND = '_execute_action' as const

/**
 * 自定义命令 ID 白名单（须与 manifest.json `commands` 键名一致）。
 * 不含保留命令 `_execute_action`（由 Chrome 打开 action；无 default_popup 时经
 * `sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` 开 Side Panel）。
 *
 * 书签 Capture 不走快捷键：用户用 Chrome 原生加书签，Yiveno 经 bookmarks.onCreated 等增量同步。
 * Chrome 最多 4 个带 `suggested_key` 的命令（含 `_execute_action`）；划词保存/附注占用建议键，
 * `open_settings` 仅注册、不设默认（可在 chrome://extensions/shortcuts 自绑）。
 * 新增自定义命令时：先追加本数组与 manifest，再 `registerExtensionCommandHandler`。
 */
export const EXTENSION_COMMAND_IDS = [
  'open_library',
  'open_settings',
  'save_selection',
  'save_selection_with_note'
] as const

export type ExtensionCommandId = (typeof EXTENSION_COMMAND_IDS)[number]

/** 判断是否为已声明的自定义扩展命令。 */
export function isExtensionCommandId(value: string): value is ExtensionCommandId {
  return (EXTENSION_COMMAND_IDS as readonly string[]).includes(value)
}
