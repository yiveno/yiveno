export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '未知'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return '未知'
  }
}
