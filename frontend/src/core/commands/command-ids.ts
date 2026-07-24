/**
 * 自定义命令 ID 白名单（须与 manifest.json `commands` 键名一致）。
 * 不含保留命令 `_execute_action`（由 Chrome 直接打开 Popup，不进入 onCommand）。
 *
 * 书签 Capture 不走快捷键：用户用 Chrome 原生加书签，Yiveno 经 bookmarks.onCreated 等增量同步。
 * 新增自定义命令时：先追加本数组与 manifest，再 `registerExtensionCommandHandler`。
 */
export const EXTENSION_COMMAND_IDS = [] as const

export type ExtensionCommandId = (typeof EXTENSION_COMMAND_IDS)[number]

/** 判断是否为已声明的自定义扩展命令。 */
export function isExtensionCommandId(value: string): value is ExtensionCommandId {
  return (EXTENSION_COMMAND_IDS as readonly string[]).includes(value)
}
