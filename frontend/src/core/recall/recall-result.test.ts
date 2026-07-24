import { describe, expect, it } from 'vitest'

import { formatMatchedFields } from '@/core/recall/recall-result'

describe('formatMatchedFields', () => {
  it('无线索时退化为字段名列表', () => {
    expect(formatMatchedFields(['title', 'domain'])).toBe('匹配：标题、域名')
    expect(formatMatchedFields([])).toBe('内容相关')
  })

  it('有线索时委托 explainRecallMatch', () => {
    expect(formatMatchedFields(['title'], '留存')).toContain('因标题')
  })
})
