import { describe, expect, it } from 'vitest'

import { selectClueProcessingDisposition } from '@/core/recall/understand/select-clue-processing-disposition'

describe('selectClueProcessingDisposition', () => {
  it('must 放行：真短词 / 专名 / URL', () => {
    const proceed = [
      'poem',
      'Cloudflare',
      'Cloudflare Workers',
      'github.com/cqw',
      'https://example.com/a',
      'auth',
      'Li Bai'
    ]
    for (const clue of proceed) {
      expect(selectClueProcessingDisposition(clue), clue).toEqual({
        disposition: 'proceed',
        rejectReason: null
      })
    }
  })

  it('must 放行：口语长句', () => {
    const proceed = [
      'The movie that I watched yesterday',
      "I recently came across a news article about a legal case. I've forgotten the details.",
      'yesterday saved a poem about Li Bai'
    ]
    for (const clue of proceed) {
      expect(selectClueProcessingDisposition(clue), clue).toEqual({
        disposition: 'proceed',
        rejectReason: null
      })
    }
  })

  it('must 拒绝：空 / 纯符号', () => {
    expect(selectClueProcessingDisposition('')).toEqual({
      disposition: 'reject_noise',
      rejectReason: 'empty'
    })
    expect(selectClueProcessingDisposition('   ')).toEqual({
      disposition: 'reject_noise',
      rejectReason: 'empty'
    })
    expect(selectClueProcessingDisposition('!!!')).toEqual({
      disposition: 'reject_noise',
      rejectReason: 'pure_symbol'
    })
    expect(selectClueProcessingDisposition(';;;')).toEqual({
      disposition: 'reject_noise',
      rejectReason: 'pure_symbol'
    })
  })

  it('must 拒绝：数字糊 / 砸键盘', () => {
    expect(selectClueProcessingDisposition('123123')).toEqual({
      disposition: 'reject_noise',
      rejectReason: 'digit_mash'
    })
    expect(selectClueProcessingDisposition('asdasd')).toEqual({
      disposition: 'reject_noise',
      rejectReason: 'keyboard_mash'
    })
    expect(selectClueProcessingDisposition('alsjdlkasjdweq;lkaskdl;aksd;lasd;hasjldhaksd')).toEqual(
      {
        disposition: 'reject_noise',
        rejectReason: 'keyboard_mash'
      }
    )
    expect(selectClueProcessingDisposition('asdfasdfasdfasdf')).toEqual({
      disposition: 'reject_noise',
      rejectReason: 'keyboard_mash'
    })
  })
})
