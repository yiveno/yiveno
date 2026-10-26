/**
 * 按 Chrome `_locales` 约定替换 `$1`…`$9`（及 `$$` → `$`）。
 * 与 `chrome.i18n.getMessage(key, substitutions)` 行为对齐，供目录直读路径使用。
 */
export function formatChromeI18nMessage(
  template: string,
  substitutions?: string | string[]
): string {
  const list =
    substitutions === undefined
      ? []
      : Array.isArray(substitutions)
        ? substitutions
        : [substitutions]

  return template.replace(/\$\$|\$([1-9])/g, (match, index) => {
    if (match === '$$') {
      return '$'
    }
    const value = list[Number(index) - 1]
    return value === undefined ? match : value
  })
}
