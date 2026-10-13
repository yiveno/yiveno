import { warnIfExtensionPageMessagesMissing } from '@/infrastructure/i18n/extension-i18n-boot'

/**
 * @deprecated 请用 `bootExtensionPage('sidepanel')` 或 `warnIfExtensionPageMessagesMissing`。
 * 保留以兼容既有 import。
 */
export function warnIfCriticalExtensionMessagesMissing(): void {
  warnIfExtensionPageMessagesMissing('sidepanel')
}
