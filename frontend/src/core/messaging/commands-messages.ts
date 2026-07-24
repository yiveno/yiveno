import { z } from 'zod'

import type { BackgroundMessageScope } from '@/core/messaging/constants'

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
      error: string
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
      error: string
    }

export type CommandsBackgroundMessage = GetExtensionCommandsMessage | OpenChromeShortcutsPageMessage

export type CommandsBackgroundResponse =
  | GetExtensionCommandsResponse
  | OpenChromeShortcutsPageResponse
