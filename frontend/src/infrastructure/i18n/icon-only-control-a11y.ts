/**
 * 图标控件无障碍：省略可见文字时 title 与 aria-label 须同源（经 t()）。
 * AppIconButton 已 fallback `ariaLabel ?? title`；父组件可用此辅助显式配对。
 */

export { assertProductSurfaceLabelAllowed } from '@/infrastructure/i18n/product-surface-label-policy'

export function resolveIconOnlyControlLabels(label: string): {
  title: string
  ariaLabel: string
} {
  const trimmed = label.trim()
  if (!trimmed) {
    throw new Error('icon-only control label 不能为空')
  }
  return { title: trimmed, ariaLabel: trimmed }
}

/**
 * 启发式：字符串是否像未解析的 message key（snake_case + 已知前缀）。
 * 用于测试与调试，非运行时强门禁。
 */
export function looksLikeExposedMessageKey(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed || trimmed.includes(' ')) {
    return false
  }
  return /^(popup|settings|library|detail|getting_started|nav|cold_start|error)_[a-z0-9_]+$/.test(
    trimmed
  )
}
