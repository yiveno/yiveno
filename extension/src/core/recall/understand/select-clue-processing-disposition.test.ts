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

  // —— R10 Gate A 长中文缺口：≥28 无空格字母串对 CJK 豁免 ——

  it('长中文 / 中英混合无空格 ≥28 → proceed（CJK 豁免）', () => {
    const p07Base =
      '昨天我读到一篇关于记忆与检索的长文章，作者讨论了人们如何组织信息、为什么会忘记曾经保存的东西，我想再找到它。'
    const p07 = p07Base.repeat(40).slice(0, 2000)
    expect(selectClueProcessingDisposition(p07)).toEqual({
      disposition: 'proceed',
      rejectReason: null
    })

    // 词表多样的真实中文长文（约 2200 字；去空白后仍无空格，撞 ≥28 分支）
    const diverseLong = (
      '人们保存网页、摘录和书签，是为了以后还能找到。可是记忆会淡，标题会变，主题也会被别的事情盖住。' +
      '检索要靠线索：时间、对象类型、自己写过的附注，以及正文里还记得的几个词。' +
      '如果系统把一整段中文长句当成砸键盘拒绝，用户就没法用自然语言描述那篇想再读的文章。'
    ).repeat(20)
    const diverseNoSpace = diverseLong.replace(/\s/g, '')
    expect(diverseNoSpace.length).toBeGreaterThan(2000)
    expect(selectClueProcessingDisposition(diverseNoSpace)).toEqual({
      disposition: 'proceed',
      rejectReason: null
    })

    const plain32 = '昨天我读到一篇关于记忆与检索的长文章，作者讨论了组织信息的方法。'
    expect([...plain32.replace(/[^\p{L}]/gu, '')].length).toBeGreaterThanOrEqual(28)
    expect(selectClueProcessingDisposition(plain32)).toEqual({
      disposition: 'proceed',
      rejectReason: null
    })

    const mixed35 = '昨天在GitHub上看到的那篇关于React性能优化的文章我想再读一遍'
    expect([...mixed35.replace(/[^\p{L}]/gu, '')].length).toBeGreaterThanOrEqual(28)
    expect(selectClueProcessingDisposition(mixed35)).toEqual({
      disposition: 'proceed',
      rejectReason: null
    })
  })

  it('拉丁乱输 ≥28 仍 keyboard_mash（防回归）', () => {
    expect(selectClueProcessingDisposition('asdfghjklqwertyuiopzxcvbnmab')).toEqual({
      disposition: 'reject_noise',
      rejectReason: 'keyboard_mash'
    })
    expect(selectClueProcessingDisposition('asdfghjklqwertyuiopzxcvbnmabcdefgh')).toEqual({
      disposition: 'reject_noise',
      rejectReason: 'keyboard_mash'
    })
    expect(selectClueProcessingDisposition('asdasd')).toEqual({
      disposition: 'reject_noise',
      rejectReason: 'keyboard_mash'
    })
    expect(selectClueProcessingDisposition('asdfasdfasdfasdf')).toEqual({
      disposition: 'reject_noise',
      rejectReason: 'keyboard_mash'
    })
  })

  it('既有放行对照不变：真词 / 叠字 / 短中文 / 有空格长中文', () => {
    expect(selectClueProcessingDisposition('sweetest')).toEqual({
      disposition: 'proceed',
      rejectReason: null
    })
    expect(selectClueProcessingDisposition('banana')).toEqual({
      disposition: 'proceed',
      rejectReason: null
    })
    expect(selectClueProcessingDisposition('哈哈哈哈哈哈哈')).toEqual({
      disposition: 'proceed',
      rejectReason: null
    })
    expect(selectClueProcessingDisposition('昨天我读到一篇关于记忆的文章')).toEqual({
      disposition: 'proceed',
      rejectReason: null
    })
    const spacedLong =
      '昨天我读到一篇关于记忆与检索的长文章，作者讨论了人们如何组织信息、为什么会忘记曾经保存的东西，我想再找到它。'.repeat(
        5
      )
    expect(selectClueProcessingDisposition(spacedLong)).toEqual({
      disposition: 'proceed',
      rejectReason: null
    })
  })
})
