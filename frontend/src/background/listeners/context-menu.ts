import { CodedError } from '@/core/common/coded-error'
import { optionalProp } from '@/core/common/optional-props'
import { captureTextExcerptFromContextMenu } from '@/application/capture/capture-text-excerpt-service'
import { ensureBackgroundBootstrapped } from '@/background/bootstrap'
import { flashActionBadge } from '@/infrastructure/browser/action-badge'
import { isSavablePageUrl } from '@/infrastructure/browser/active-tab-reader'
import { logger } from '@/infrastructure/logging/logger'
import { t } from '@/infrastructure/i18n/t'

/** 右键菜单：保存选区到 Yiveno。 */
export const CONTEXT_MENU_SAVE_SELECTION_ID = 'yiveno-save-selection' as const

function getContextMenuTitle(): string {
  return t('context_menu_save_selection')
}

let listenersRegistered = false
let registerMenuInFlight: Promise<void> | null = null

/** 将 chrome.contextMenus 回调转为 Promise，并消费 lastError。 */
function promisifyContextMenuAction(action: (done: () => void) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    action(() => {
      const { lastError } = chrome.runtime
      if (lastError) {
        reject(new Error(lastError.message))
        return
      }
      resolve()
    })
  })
}

/** 创建或更新单个菜单项（先 update，不存在再 create）。 */
async function upsertContextMenuItem(): Promise<void> {
  const title = getContextMenuTitle()

  try {
    await promisifyContextMenuAction(done => {
      chrome.contextMenus.update(
        CONTEXT_MENU_SAVE_SELECTION_ID,
        { title, contexts: ['selection'] },
        done
      )
    })
    return
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('No matching item') && !message.includes('Cannot find menu item')) {
      throw error
    }
  }

  await promisifyContextMenuAction(done => {
    chrome.contextMenus.create(
      {
        id: CONTEXT_MENU_SAVE_SELECTION_ID,
        title,
        contexts: ['selection']
      },
      done
    )
  })
}

/** 创建或更新右键选区菜单项；并发调用会合并为一次。仅在 chrome.runtime.onInstalled 中调用。 */
export async function registerContextMenuItems(): Promise<void> {
  if (registerMenuInFlight) {
    return registerMenuInFlight
  }

  registerMenuInFlight = upsertContextMenuItem()
    .catch(error => {
      logger.error('ContextMenu', '注册右键菜单失败', error)
      throw error
    })
    .finally(() => {
      registerMenuInFlight = null
    })

  return registerMenuInFlight
}

/** 处理右键菜单点击：保存 Text Excerpt。 */
export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  if (info.menuItemId !== CONTEXT_MENU_SAVE_SELECTION_ID) {
    return
  }

  const selectionText = info.selectionText?.trim()
  const sourceUrl = info.pageUrl ?? tab?.url
  if (!selectionText || !sourceUrl) {
    throw new CodedError('CAPTURE_EMPTY_SELECTION')
  }

  if (!isSavablePageUrl(sourceUrl)) {
    throw new CodedError('CAPTURE_UNSAVABLE_PAGE')
  }

  const item = await captureTextExcerptFromContextMenu({
    selectionText,
    sourceUrl,
    pageTitle: tab?.title ?? '',
    ...optionalProp('tabId', tab?.id)
  })

  void flashActionBadge('success')
  logger.info('ContextMenu', '选区已保存为 Text Excerpt', {
    memoryItemId: item.id,
    sourceUrl
  })
}

/** 注册右键菜单与点击监听器（仅 Background 调用一次）。 */
export function registerContextMenuListeners(): void {
  if (listenersRegistered) {
    return
  }
  listenersRegistered = true

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    void ensureBackgroundBootstrapped()
      .then(() => handleContextMenuClick(info, tab))
      .catch(error => {
        logger.error('ContextMenu', '保存选区失败', error)
        void flashActionBadge('error')
      })
  })

  logger.info('ContextMenu', '右键选区菜单监听器已注册')
}

/** 测试用：重置监听器注册状态。 */
export function resetContextMenuListenersForTests(): void {
  listenersRegistered = false
  registerMenuInFlight = null
}
