import { describe, expect, it } from 'vitest'

import {
  EXTERNAL_AUTH_HANDOFF_MATCH_PATTERNS,
  EXTERNAL_AUTH_HANDOFF_ORIGINS,
  isExternallyConnectableOrigin
} from '@/core/extension/externally-connectable-origins'

describe('externally-connectable-origins', () => {
  it('match patterns 与 origins 一一对应', () => {
    expect(EXTERNAL_AUTH_HANDOFF_MATCH_PATTERNS).toEqual(
      EXTERNAL_AUTH_HANDOFF_ORIGINS.map(origin => `${origin}/*`)
    )
  })

  it('允许生产与本地官网 origin', () => {
    expect(isExternallyConnectableOrigin('https://yiveno.com/account')).toBe(true)
    expect(isExternallyConnectableOrigin('https://www.yiveno.com/login')).toBe(true)
    expect(isExternallyConnectableOrigin('http://localhost:3001/account')).toBe(true)
    expect(isExternallyConnectableOrigin('https://localhost:3002/login')).toBe(true)
  })

  it('拒绝非白名单与非法 URL', () => {
    expect(isExternallyConnectableOrigin('https://evil.com/callback')).toBe(false)
    expect(isExternallyConnectableOrigin(undefined)).toBe(false)
    expect(isExternallyConnectableOrigin('not-a-url')).toBe(false)
  })
})
