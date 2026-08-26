import { z } from 'zod'

import type { BackgroundMessageScope } from '@/core/messaging/constants'

/** Commands 面向 UI 的稳定错误码。 */
export const CommandsErrorCodeSchema = z.enum([
  'COMMANDS_READ_FAILED', // 读取扩展命令失败
  'SHORTCUTS_PAGE_OPEN_FAILED', // 打开快捷键设置页失败
  'RECALL_SHELL_OPEN_FAILED', // 打开 Recall Side Panel 失败
  'NAVIGATE_TAB_FAILED' // 活动标签导航失败
])

export type CommandsErrorCode = z.infer<typeof CommandsErrorCodeSchema>

const navigateActiveTabPayloadSchema = z.object({
  /** 目标 URL（http(s) 或扩展 detail.html） */
  url: z.string().min(1).max(4000),
  /**
   * 导航处置。
   * - currentTab：复用当前活动标签（默认）
   * - newForegroundTab：新建前台标签（⌘/Ctrl+点击）
   */
  disposition: z
    .enum([
      'currentTab', // 复用当前活动标签
      'newForegroundTab' // 新建前台标签
    ])
    .optional()
})

export type NavigateActiveTabPayload = z.infer<typeof navigateActiveTabPayloadSchema>

/** 在浏览器标签打开 URL（Side Panel 结果预览默认复用活动标签）。 */
export type NavigateActiveTabMessage = {
  scope: BackgroundMessageScope
  type: 'NAVIGATE_ACTIVE_TAB'
  payload: NavigateActiveTabPayload
}

export type NavigateActiveTabResponse =
  | {
      ok: true
    }
  | {
      ok: false
      errorCode: CommandsErrorCode
      error?: string
    }

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

/** 在用户手势链上打开 Recall Side Panel（预填线索须已写入 session）。 */
export type OpenRecallShellMessage = {
  scope: BackgroundMessageScope
  type: 'OPEN_RECALL_SHELL'
}

export type OpenRecallShellResponse =
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
  | OpenRecallShellMessage
  | NavigateActiveTabMessage

export type CommandsBackgroundResponse =
  | GetExtensionCommandsResponse
  | OpenChromeShortcutsPageResponse
  | OpenRecallShellResponse
  | NavigateActiveTabResponse

export function parseNavigateActiveTabPayload(value: unknown): NavigateActiveTabPayload {
  return navigateActiveTabPayloadSchema.parse(value)
}
