import { describe, expect, it } from 'vitest'

import {
  synthesizeEchoContentTermExcludeClue,
  synthesizeEchoObjectTypeReplaceClue,
  synthesizeEchoTimeReplaceClue
} from '@/core/recall/synthesize-echo-correction-clue'

describe('synthesizeEchoCorrectionClue', () => {
  it('时间 Replace 用短英文 surface', () => {
    expect(synthesizeEchoTimeReplaceClue('yesterday')).toBe('yesterday')
    expect(synthesizeEchoTimeReplaceClue('recent')).toBe('recently')
    expect(synthesizeEchoTimeReplaceClue('a_while_ago')).toBe('a while ago')
  })

  it('类型 Replace 用 canonical surface', () => {
    expect(synthesizeEchoObjectTypeReplaceClue('article')).toBe('article')
    expect(synthesizeEchoObjectTypeReplaceClue('video')).toBe('video')
  })

  it('内容词 Exclude 写成 not the …', () => {
    expect(synthesizeEchoContentTermExcludeClue('retention')).toBe('not the retention')
    expect(synthesizeEchoContentTermExcludeClue('  ')).toBe('')
  })
})
