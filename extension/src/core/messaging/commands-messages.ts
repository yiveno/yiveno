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

/**
 * 打开 Recall Side Panel 时可附带预填（划选「用这段来找」）。
 * SW 内先开火 `sidePanel.open` 再写 session（与 Omnibox 同手势铁律）；无 payload 时仅开壳。
 */
export const openRecallShellPayloadSchema = z.object({
  /** 预填进 composer 的 clue；缺省则只开壳 */
  clue: z.string().min(1).max(500).optional(),
  /**
   * 是否开壳后自动提交。
   * - true / 缺省：Getting Started / Omnibox 行为（若带 clue）
   * - false：选区富线索，只预填可改
   */
  autoSubmit: z.boolean().optional()
})

export type OpenRecallShellPayload = z.infer<typeof openRecallShellPayloadSchema>

/** 在用户手势链上打开 Recall Side Panel；可选附带预填 clue。 */
export type OpenRecallShellMessage = {
  scope: BackgroundMessageScope
  type: 'OPEN_RECALL_SHELL'
  payload?: OpenRecallShellPayload
}

/** 解析可选开壳预填载荷（无 / 非法 → 空对象，仅开壳）。 */
export function parseOpenRecallShellPayload(value: unknown): OpenRecallShellPayload {
  if (value === undefined || value === null) {
    return {}
  }
  const parsed = openRecallShellPayloadSchema.safeParse(value)
  return parsed.success ? parsed.data : {}
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
