/**
 * Connect 软条失败文案分流：仅 timeout 用专属 key；禁止把原始 error 直出用户面。
 */

import type { MessageKey } from '@/infrastructure/i18n/message-keys'

/** 失败响应 → 文案 key；cancelled 返回 null（不报错）。 */
export function resolveWebsiteConnectFailedMessageKey(input: {
  cancelled?: boolean
  error?: string
}): MessageKey | null {
  if (input.cancelled) {
    return null
  }
  if (input.error === 'timeout') {
    return 'sidepanel_website_connect_failed_timeout'
  }
  return 'sidepanel_website_connect_failed'
}
