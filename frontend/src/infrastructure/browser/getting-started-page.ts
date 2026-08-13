/**
 * 打开扩展 Getting Started 页（Popup / 引导页内复用）。
 */
export function openGettingStartedPage(): void {
  const url = chrome.runtime.getURL('getting-started.html')
  window.open(url, '_blank', 'noopener,noreferrer')
}
