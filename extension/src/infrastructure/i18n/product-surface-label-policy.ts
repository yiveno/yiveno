/**
 * 产品面文案禁用词策略（术语表：对用户禁止 Search，用 Recall / Filter）。
 * 供 i18n:check 全量扫描与启动门禁复用。
 */

/** 整词 Search（大小写不敏感）。 */
export const FORBIDDEN_PRODUCT_SURFACE_LABEL_PATTERN = /\bsearch\b/i

export interface ProductSurfaceLabelViolation {
  key: string
  message: string
  matched: string
}

/** 返回命中的禁用词；无违规则 null。 */
export function findProductSurfaceLabelViolation(text: string): string | null {
  const match = text.match(FORBIDDEN_PRODUCT_SURFACE_LABEL_PATTERN)
  return match ? match[0] : null
}

/** 校验单条用户可见文案。 */
export function assertProductSurfaceLabelAllowed(label: string): void {
  const matched = findProductSurfaceLabelViolation(label)
  if (matched) {
    throw new Error(`产品面文案禁止包含 Search: ${label}`)
  }
}

/** 扫描 chrome.i18n messages.json 全量 message 字段。 */
export function scanEnMessagesForProductSurfaceViolations(
  messages: Record<string, { message?: string }>
): ProductSurfaceLabelViolation[] {
  const violations: ProductSurfaceLabelViolation[] = []
  for (const [key, entry] of Object.entries(messages)) {
    const message = entry.message ?? ''
    const matched = findProductSurfaceLabelViolation(message)
    if (matched) {
      violations.push({ key, message, matched })
    }
  }
  return violations.sort((a, b) => a.key.localeCompare(b.key))
}
