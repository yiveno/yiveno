/**
 * 按 Chrome `_locales` 约定格式化文案（目录直读路径，对齐 `chrome.i18n.getMessage`）。
 *
 * 顺序：
 * 1. 命名占位 `$name$` → placeholders[name].content（常为 `$1`…`$9`；大小写不敏感）
 * 2. `$1`…`$9` → substitutions
 * 3. `$$` → `$`
 */

export type ChromeI18nPlaceholders = Record<string, { content: string; example?: string }>

export function formatChromeI18nMessage(
  template: string,
  substitutions?: string | string[],
  placeholders?: ChromeI18nPlaceholders
): string {
  const list =
    substitutions === undefined
      ? []
      : Array.isArray(substitutions)
        ? substitutions
        : [substitutions]

  const withNamed = applyNamedPlaceholders(template, placeholders)
  return withNamed.replace(/\$\$|\$([1-9])/g, (match, index) => {
    if (match === '$$') {
      return '$'
    }
    const value = list[Number(index) - 1]
    return value === undefined ? match : value
  })
}

/** Chrome：占位名大小写不敏感；未声明的 `$name$` 原样保留。 */
function applyNamedPlaceholders(
  template: string,
  placeholders: ChromeI18nPlaceholders | undefined
): string {
  if (!placeholders) {
    return template
  }

  const byLower = new Map<string, string>()
  for (const [name, spec] of Object.entries(placeholders)) {
    byLower.set(name.toLowerCase(), spec.content)
  }

  return template.replace(/\$([A-Za-z][A-Za-z0-9_]*)\$/g, (match, name: string) => {
    const content = byLower.get(name.toLowerCase())
    return content === undefined ? match : content
  })
}
