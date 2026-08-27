import { describe, expect, test } from 'bun:test'

import { tokenizeMcpClue } from './cloud-keyword-recall'

describe('tokenizeMcpClue', () => {
  test('拆出小写 token 并去重', () => {
    expect(tokenizeMcpClue('Deploy Checklist deploy')).toEqual(['deploy', 'checklist'])
  })

  test('忽略过短片段', () => {
    expect(tokenizeMcpClue('a to i')).toEqual(['to'])
  })
})
