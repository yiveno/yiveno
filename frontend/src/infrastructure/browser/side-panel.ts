/**
 * Chrome Side Panel（Recall 主壳 R-shell）。
 *
 * - **Service Worker**：`openRecallSidePanel`（划词等经 `OPEN_RECALL_SHELL`；须在手势链上尽快调用，禁止先 await bootstrap/storage）
 * - **扩展页**：`openRecallSidePanelFromExtensionPage`（Getting Started 等按钮须本页直调；经 SW 会丢用户手势）
 *
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
  /** 次选：窗口 id（扩展页 / 无 tab 时） */
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
    logger.error(
      'SidePanel',
      'setPanelBehavior 失败（工具栏图标路径可能不可用；扩展页仍可本页直调 open）',
      error
    )
  }
}

/**
 * 打开/聚焦 Recall Side Panel。
 * 优先 tabId → 显式 windowId → `WINDOW_ID_CURRENT`（禁止先 await getCurrent，以免丢用户手势）。
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

    const windowId =
      typeof options.windowId === 'number' ? options.windowId : chrome.windows.WINDOW_ID_CURRENT

    await api.open({ windowId })
    flowOk('SidePanel', '打开 Recall 主壳', startedAt, {
      via: typeof options.windowId === 'number' ? 'windowId' : 'WINDOW_ID_CURRENT',
      windowId
    })
  } catch (error) {
    flowFail('SidePanel', '打开 Recall 主壳', startedAt, error)
    throw error
  }
}

/**
 * 扩展页按钮手势内打开 Side Panel。
 * Getting Started 等不得 `sendMessage`→SW：bootstrap / 消息往返会丢掉 `sidePanel.open` 所需用户手势。
 */
export async function openRecallSidePanelFromExtensionPage(): Promise<void> {
  await openRecallSidePanel({ windowId: chrome.windows.WINDOW_ID_CURRENT })
}
