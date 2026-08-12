export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Unknown'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return 'Unknown'
  }
}
