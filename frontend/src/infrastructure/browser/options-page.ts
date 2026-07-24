/**
 * 打开扩展设置页（Chrome options_ui）。
 * 可在 Popup / Settings 等扩展页面调用；不经 tabs API。
 */
export async function openExtensionOptionsPage(): Promise<void> {
  await chrome.runtime.openOptionsPage()
}
