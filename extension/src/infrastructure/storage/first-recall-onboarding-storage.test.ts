import { describe, expect, it } from 'vitest'

import { parseRecallPrefillStorageValue } from '@/infrastructure/storage/first-recall-onboarding-storage'

describe('parseRecallPrefillStorageValue', () => {
  it('兼容旧版纯字符串（默认自动提交）', () => {
    expect(parseRecallPrefillStorageValue('  that article  ')).toEqual({
      clue: 'that article',
      autoSubmit: true
    })
    expect(parseRecallPrefillStorageValue('   ')).toBeNull()
  })

  it('解析对象载荷；autoSubmit 缺省为 true，显式 false 保留', () => {
    expect(parseRecallPrefillStorageValue({ clue: 'poem', autoSubmit: false })).toEqual({
      clue: 'poem',
      autoSubmit: false
    })
    expect(parseRecallPrefillStorageValue({ clue: 'poem' })).toEqual({
      clue: 'poem',
      autoSubmit: true
    })
  })
})
