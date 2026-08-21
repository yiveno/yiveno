/**
 * Chrome Side Panel（Recall 主壳 R-shell）。
 * 仅 Background / Service Worker 调用。
 * `@types/chrome` 未覆盖 sidePanel 时用最小本地类型。
 */

import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

/** Side Panel API 最小面（开壳 / 行为）。 */
interface SidePanelApi {
  setPanelBehavior(behavior: { openPanelOnActionClick: boolean }): Promise<void>
  open(options: { tabId?: number; windowId?: number }): Promise<void>
}

type ChromeWithSidePanel = typeof chrome & { sidePanel?: SidePanelApi }

/** 打开 Side Panel 时可选的窗口/标签上下文（来自用户手势链）。 */
export interface OpenRecallSidePanelOptions {
  /** 优先：当前标签（content script 消息常带） */
  tabId?: number
  /** 次选：窗口 id（扩展页消息） */
  windowId?: number
}

/** 读取运行时 sidePanel API；不可用时返回 undefined。 */
function getSidePanelApi(): SidePanelApi | undefined {
  if (typeof chrome === 'undefined') {
    return undefined
  }
  return (chrome as ChromeWithSidePanel).sidePanel
}

/**
 * 幂等：点工具栏图标打开 Side Panel（须无 action.default_popup）。
 * install / 每次 SW 启动均可调用。
 */
export async function ensureSidePanelOpensOnActionClick(): Promise<void> {
  const startedAt = flowStart('SidePanel', '配置 openPanelOnActionClick')
  const api = getSidePanelApi()
  if (!api) {
    flowFail(
      'SidePanel',
      '配置 openPanelOnActionClick',
      startedAt,
      new Error('sidePanel API 不可用')
    )
    return
  }

  try {
    await api.setPanelBehavior({ openPanelOnActionClick: true })
    flowOk('SidePanel', '配置 openPanelOnActionClick', startedAt, { openPanelOnActionClick: true })
  } catch (error) {
    flowFail('SidePanel', '配置 openPanelOnActionClick', startedAt, error)
    logger.warn(
      'SidePanel',
      'setPanelBehavior 失败（扩展页可能仍可经 side_panel.default_path 打开）',
      error
    )
  }
}

/**
 * 在用户手势链上打开/聚焦 Recall Side Panel。
 * 优先 tabId → windowId → chrome.windows.getCurrent()。
 */
export async function openRecallSidePanel(options: OpenRecallSidePanelOptions = {}): Promise<void> {
  const startedAt = flowStart('SidePanel', '打开 Recall 主壳')
  const api = getSidePanelApi()
  if (!api) {
    const err = new Error('sidePanel API 不可用')
    flowFail('SidePanel', '打开 Recall 主壳', startedAt, err)
    throw err
  }

  try {
    if (typeof options.tabId === 'number') {
      await api.open({ tabId: options.tabId })
      flowOk('SidePanel', '打开 Recall 主壳', startedAt, { via: 'tabId', tabId: options.tabId })
      return
    }

    let windowId = options.windowId
    if (typeof windowId !== 'number') {
      const current = await chrome.windows.getCurrent()
      windowId = current.id
    }
    if (typeof windowId !== 'number') {
      throw new Error('无法解析 windowId')
    }

    await api.open({ windowId })
    flowOk('SidePanel', '打开 Recall 主壳', startedAt, { via: 'windowId', windowId })
  } catch (error) {
    flowFail('SidePanel', '打开 Recall 主壳', startedAt, error)
    throw error
  }
}
