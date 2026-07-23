import { optionalProp } from '@/core/common/optional-props'

/** 当前活动标签页的可保存页面信息。 */
export interface ActivePageInfo {
  title: string
  url: string
  faviconUrl?: string
}

/** 判断 URL 是否可保存为 MemoryItem。 */
export function isSavablePageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 读取当前窗口活动标签页信息。
 * 仅允许在 Background 调用；需 activeTab 或 tabs 权限。
 */
export async function readActivePageInfo(): Promise<ActivePageInfo | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]

  if (!tab?.url || !tab.title || !isSavablePageUrl(tab.url)) {
    return null
  }

  return {
    title: tab.title,
    url: tab.url,
    ...optionalProp('faviconUrl', tab.favIconUrl)
  }
}
