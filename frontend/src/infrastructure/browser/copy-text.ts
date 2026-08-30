/** 将文本写入系统剪贴板；扩展页面上下文可用。 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) {
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
