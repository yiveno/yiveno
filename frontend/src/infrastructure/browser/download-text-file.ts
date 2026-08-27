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
