/**
 * 打开扩展记忆库页（轻浏览）。
 * 可在 Popup / Settings 等扩展页面调用；用 window.open，不经 tabs API。
 */
export function openExtensionLibraryPage(): void {
  const url = chrome.runtime.getURL('library.html')
  window.open(url, '_blank', 'noopener,noreferrer')
}
