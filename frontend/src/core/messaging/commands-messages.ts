import { z } from 'zod'

import type { BackgroundMessageScope } from '@/core/messaging/constants'

/** Commands 面向 UI 的稳定错误码。 */
export const CommandsErrorCodeSchema = z.enum([
  'COMMANDS_READ_FAILED', // 读取扩展命令失败
  'SHORTCUTS_PAGE_OPEN_FAILED', // 打开快捷键设置页失败
  'RECALL_POPUP_OPEN_FAILED' // 打开 Recall Popup 失败
])

export type CommandsErrorCode = z.infer<typeof CommandsErrorCodeSchema>

/** 单条扩展命令及其当前快捷键（供设置页展示）。 */
export const ExtensionCommandInfoSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  shortcut: z.string()
})

export type ExtensionCommandInfo = z.infer<typeof ExtensionCommandInfoSchema>

/** 读取扩展已注册命令与快捷键绑定。 */
export type GetExtensionCommandsMessage = {
  scope: BackgroundMessageScope
  type: 'GET_EXTENSION_COMMANDS'
}

export type GetExtensionCommandsResponse =
  | {
      ok: true
      commands: ExtensionCommandInfo[]
    }
  | {
      ok: false
      errorCode: CommandsErrorCode
      error?: string
    }

/**
 * 打开 Chrome 原生快捷键设置页（chrome://extensions/shortcuts）。
 * 扩展无法自行改键，只能引导用户到此页。
 */
export type OpenChromeShortcutsPageMessage = {
  scope: BackgroundMessageScope
  type: 'OPEN_CHROME_SHORTCUTS_PAGE'
}

export type OpenChromeShortcutsPageResponse =
  | {
      ok: true
    }
  | {
      ok: false
      errorCode: CommandsErrorCode
      error?: string
    }

/** 在用户手势链上打开 Recall Popup（预填线索须已写入 session）。 */
export type OpenRecallPopupMessage = {
  scope: BackgroundMessageScope
  type: 'OPEN_RECALL_POPUP'
}

export type OpenRecallPopupResponse =
  | {
      ok: true
    }
  | {
      ok: false
      errorCode: CommandsErrorCode
      error?: string
    }

export type CommandsBackgroundMessage =
  | GetExtensionCommandsMessage
  | OpenChromeShortcutsPageMessage
  | OpenRecallPopupMessage

export type CommandsBackgroundResponse =
  | GetExtensionCommandsResponse
  | OpenChromeShortcutsPageResponse
  | OpenRecallPopupResponse
