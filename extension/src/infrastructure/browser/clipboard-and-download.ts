/**
 * 扩展 UI 文本剪贴板与下载（由原 copy-text / download-text-file 机械合并）。
 */

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

/**
 * 触发浏览器下载文本文件（扩展 UI 用）。
 */
export function downloadTextFile(input: {
  filename: string
  content: string
  mimeType?: string
}): void {
  const blob = new Blob([input.content], {
    type: input.mimeType ?? 'text/plain;charset=utf-8'
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = input.filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
