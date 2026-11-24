import { describe, expect, it } from 'vitest'

import { resolveWebsiteConnectFailedMessageKey } from '@/pages/sidepanel/resolve-website-connect-failed-copy'

describe('resolveWebsiteConnectFailedMessageKey', () => {
  it('timeout → timeout key', () => {
    expect(resolveWebsiteConnectFailedMessageKey({ error: 'timeout' })).toBe(
      'sidepanel_website_connect_failed_timeout'
    )
  })

  it('其它字符串 / 缺省 error / 抛错后的 message 字面 → 通用失败 key', () => {
    expect(resolveWebsiteConnectFailedMessageKey({ error: 'bridge_gone' })).toBe(
      'sidepanel_website_connect_failed'
    )
    // 打开账户页失败等：catch/调用方只传 Error.message 字面，禁止直出用户面
    expect(resolveWebsiteConnectFailedMessageKey({ error: 'Failed to open tab' })).toBe(
      'sidepanel_website_connect_failed'
    )
    expect(resolveWebsiteConnectFailedMessageKey({})).toBe('sidepanel_website_connect_failed')
  })

  it('cancelled → null（不产生错误文案）', () => {
    expect(resolveWebsiteConnectFailedMessageKey({ cancelled: true })).toBeNull()
    expect(resolveWebsiteConnectFailedMessageKey({ cancelled: true, error: 'timeout' })).toBeNull()
  })
})
