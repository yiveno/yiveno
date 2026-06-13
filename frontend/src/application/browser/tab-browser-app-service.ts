/**
 * 标签页浏览器应用服务
 *
 * 职责：presentation 层统一通过 Background 操作 chrome.tabs / sidePanel，禁止页面直连 Chrome Tabs API。
 */
import type { Result } from '@/core/common/result'
import { ok, err } from '@/core/common/result'
import { logger } from '@/infrastructure/logging/logger'

/** 当前活动标签页摘要 */
export interface ActiveTabInfo {
  id: number | null
  url: string
  title: string
  windowId: number | null
}

interface TabMessageResponse {
  success?: boolean
  ok?: boolean
  tab?: ActiveTabInfo | null
  error?: string
}

function getTabMessageFailure(response: TabMessageResponse | undefined): Error | null {
  if (response && 'success' in response && response.success === false) {
    return new Error(response.error ?? '操作失败')
  }
  if (response && 'ok' in response && response.ok === false) {
    return new Error(response.error ?? '操作失败')
  }
  return null
}

/**
 * 向 Background 发送标签页相关消息
 */
async function sendTabMessage(
  type: string,
  data?: Record<string, unknown>
): Promise<Result<TabMessageResponse, Error>> {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return err(new Error('Chrome runtime 不可用'))
    }

    const response = (await chrome.runtime.sendMessage({ type, data })) as
      | TabMessageResponse
      | undefined

    if (chrome.runtime.lastError) {
      return err(new Error(chrome.runtime.lastError.message))
    }

    const failure = getTabMessageFailure(response)
    if (failure) {
      return err(failure)
    }

    return ok(response ?? {})
  } catch (error) {
    logger.warn('TabBrowserAppService', `${type} 失败`, error)
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * 标签页浏览器应用服务
 */
export class TabBrowserAppService {
  /** 打开书签整理页 */
  async openManagementPage(): Promise<Result<void>> {
    const result = await sendTabMessage('OPEN_MANAGEMENT_PAGE')
    return result.ok ? ok(undefined) : err(result.error)
  }

  /** 打开设置页 */
  async openSettingsPage(): Promise<Result<void>> {
    const result = await sendTabMessage('OPEN_SETTINGS_PAGE')
    return result.ok ? ok(undefined) : err(result.error)
  }

  /** 打开侧边栏 */
  async openSidePanel(): Promise<Result<void>> {
    const result = await sendTabMessage('OPEN_SIDE_PANEL')
    return result.ok ? ok(undefined) : err(result.error)
  }

  /** 获取当前活动标签页 */
  async getCurrentActiveTab(): Promise<Result<ActiveTabInfo | null>> {
    const result = await sendTabMessage('GET_CURRENT_TAB')
    if (!result.ok) return err(result.error)
    return ok(result.value.tab ?? null)
  }

  /** 在当前活动标签页打开 URL */
  async openUrlInActiveTab(url: string): Promise<Result<void>> {
    const result = await sendTabMessage('OPEN_BOOKMARK_URL', { url, mode: 'active' })
    return result.ok ? ok(undefined) : err(result.error)
  }

  /** 在新标签页打开 URL */
  async openUrlInNewTab(url: string): Promise<Result<void>> {
    const result = await sendTabMessage('OPEN_BOOKMARK_URL', { url, mode: 'new_tab' })
    return result.ok ? ok(undefined) : err(result.error)
  }

  /** 打开浏览器系统页面 */
  async openSystemUrl(url: string): Promise<Result<void>> {
    const result = await sendTabMessage('OPEN_SYSTEM_URL', { url })
    return result.ok ? ok(undefined) : err(result.error)
  }
}

export const tabBrowserAppService = new TabBrowserAppService()
