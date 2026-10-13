import { describe, expect, it } from 'vitest'

import { isLogScope, LOG_SCOPES } from '@/infrastructure/logging/log-scopes'

describe('LOG_SCOPES', () => {
  it('闭集无重复', () => {
    expect(new Set(LOG_SCOPES).size).toBe(LOG_SCOPES.length)
  })

  it('isLogScope 只认登记成员', () => {
    expect(isLogScope('MemoryEmbed')).toBe(true)
    expect(isLogScope('RecallFlow')).toBe(true)
    expect(isLogScope('NotARealScope')).toBe(false)
  })

  it('含启动截图常见 scope', () => {
    for (const scope of [
      'Background',
      'SidePanel',
      'MemorySync',
      'ClueLlm',
      'ColdStart',
      'MemoryEmbed',
      'Embed'
    ] as const) {
      expect(LOG_SCOPES).toContain(scope)
    }
  })
})
