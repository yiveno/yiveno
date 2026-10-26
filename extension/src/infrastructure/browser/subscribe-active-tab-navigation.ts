/**
 * 订阅「当前活动标签导航可能变化」事件（切 tab / URL 更新 / 窗口焦点）。
 * 供 Side Panel 等 UI 刷新页面上下文域名；chrome.tabs / windows 仅本层调用。
 */

/** tab 更新中会触发导航刷新的变更字段。 */
export type ActiveTabNavigationChangeInfo = {
  url?: string
  status?: string
}

/**
 * 是否因 tab 更新而值得刷新页面上下文。
 * 仅 url 变化或加载 complete 时刷新，避免 title 等噪声。
 */
export function shouldRefreshOnTabUpdated(changeInfo: ActiveTabNavigationChangeInfo): boolean {
  return Boolean(changeInfo.url || changeInfo.status === 'complete')
}

/**
 * 是否因窗口焦点变化而刷新（忽略失焦到无窗口）。
 */
export function shouldRefreshOnWindowFocusChanged(windowId: number): boolean {
  return windowId !== chrome.windows.WINDOW_ID_NONE
}

/**
 * 订阅活动标签导航相关事件。返回取消订阅函数。
 * @param onNavigate 防抖由调用方负责；本函数仅在相关事件时回调。
 */
export function subscribeActiveTabNavigation(onNavigate: () => void): () => void {
  const handleActivated = (): void => {
    onNavigate()
  }

  const handleUpdated = (_tabId: number, changeInfo: ActiveTabNavigationChangeInfo): void => {
    if (shouldRefreshOnTabUpdated(changeInfo)) {
      onNavigate()
    }
  }

  const handleFocusChanged = (windowId: number): void => {
    if (shouldRefreshOnWindowFocusChanged(windowId)) {
      onNavigate()
    }
  }

  chrome.tabs.onActivated.addListener(handleActivated)
  chrome.tabs.onUpdated.addListener(handleUpdated)
  chrome.windows.onFocusChanged.addListener(handleFocusChanged)

  return () => {
    chrome.tabs.onActivated.removeListener(handleActivated)
    chrome.tabs.onUpdated.removeListener(handleUpdated)
    chrome.windows.onFocusChanged.removeListener(handleFocusChanged)
  }
}
