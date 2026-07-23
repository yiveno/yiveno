/**
 * 在页面上下文执行：提取选区及前后少量上下文。
 * 必须自包含，不可引用外部变量（供 chrome.scripting.executeScript 序列化）。
 */
export function extractSelectionContextOnPage(): {
  selectedText: string
  contextBefore?: string
  contextAfter?: string
} | null {
  const maxContextLength = 80
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return null
  }

  const selectedText = selection.toString().trim()
  if (!selectedText) {
    return null
  }

  const container = selection.getRangeAt(0).commonAncestorContainer
  const fullText = container.textContent ?? ''
  const selectedIndex = fullText.indexOf(selectedText)
  if (selectedIndex === -1) {
    return { selectedText }
  }

  const contextBefore = fullText
    .slice(Math.max(0, selectedIndex - maxContextLength), selectedIndex)
    .trim()
  const contextAfter = fullText
    .slice(
      selectedIndex + selectedText.length,
      selectedIndex + selectedText.length + maxContextLength
    )
    .trim()

  return {
    selectedText,
    ...(contextBefore ? { contextBefore } : {}),
    ...(contextAfter ? { contextAfter } : {})
  }
}
