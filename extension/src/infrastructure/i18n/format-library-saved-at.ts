import { getUILanguage } from '@/infrastructure/i18n/t'

/** Library 摘录/书签列表：保存时间展示（locale 感知；非当年补年份）。 */
export function formatLibrarySavedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  const includeYear = date.getFullYear() !== new Date().getFullYear()
  return date.toLocaleString(getUILanguage(), {
    ...(includeYear ? { year: 'numeric' as const } : {}),
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
