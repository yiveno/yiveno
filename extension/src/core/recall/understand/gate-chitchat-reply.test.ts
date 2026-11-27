/**
 * 非召回二次回复门禁（长度 / 语言 / 删除边界）。
 */

import { describe, expect, it, vi } from 'vitest'

import { clearLlmParseCache } from '@/core/recall/understand/llm-parse-cache'
import {
  gateChitchatReply,
  parseRecallClueWithLlm,
  type LlmChatCompleter
} from '@/core/recall/understand/parse-recall-clue-with-llm'

describe('gateChitchatReply', () => {
  it('中文过长 → too_long', () => {
    const reply = '啊'.repeat(161)
    expect(gateChitchatReply('今天天气不错', reply)).toBe('too_long')
  })

  it('英文过长 → too_long', () => {
    const reply = Array.from({ length: 81 }, (_, index) => `word${index}`).join(' ')
    expect(gateChitchatReply('nice weather today', reply)).toBe('too_long')
  })

  it('语言不匹配 → language_mismatch', () => {
    expect(gateChitchatReply('今天天气不错', 'Nice day — looking for something?')).toBe(
      'language_mismatch'
    )
    expect(gateChitchatReply('nice weather', '挺好的，想找点什么吗？')).toBe('language_mismatch')
  })

  it('删除类线索缺边界 → missing_delete_boundary', () => {
    expect(gateChitchatReply('把书签全删了', '好的，我来帮你处理。')).toBe(
      'missing_delete_boundary'
    )
    expect(gateChitchatReply('please delete everything', 'Sure, I can help with that.')).toBe(
      'missing_delete_boundary'
    )
  })

  it('正常回复通过', () => {
    expect(gateChitchatReply('今天天气不错', '阳光挺好——要找存过的什么吗？')).toBeNull()
    expect(
      gateChitchatReply('nice weather', 'Looks nice out — anything you want to find?')
    ).toBeNull()
    expect(gateChitchatReply('把书签全删了', '我不会删东西——想找什么可以说。')).toBeNull()
  })
})

describe('refreshChitchatReply 门禁接入（mock completer）', () => {
  const chitchatProposalJson = (assistantReply: string) =>
    JSON.stringify({
      timeLabel: null,
      objectTypes: [],
      behaviorHints: [],
      noteHint: false,
      contentTerms: [],
      intent: 'chitchat',
      assistantReply,
      confidence: 'low'
    })

  it('三类拒收回落原回复；正常通过采用二次回复', async () => {
    clearLlmParseCache()
    const original = '天气不错哦，想找点什么吗？'

    const makeSecond = (second: string): LlmChatCompleter => {
      let n = 0
      return async () => {
        n += 1
        if (n === 1) {
          return chitchatProposalJson(original)
        }
        return second
      }
    }

    const tooLong = await parseRecallClueWithLlm('今天天气不错', {
      complete: makeSecond('啊'.repeat(161)),
      useCache: false
    })
    expect(tooLong.assistantReply).toBe(original)

    const mismatch = await parseRecallClueWithLlm('今天天气不错', {
      complete: makeSecond('Nice day — looking for something saved?'),
      useCache: false
    })
    expect(mismatch.assistantReply).toBe(original)

    const deleteOriginal = '我不会删东西——想找什么可以说。'
    let deleteCalls = 0
    const deleteParsed = await parseRecallClueWithLlm('把书签全删了', {
      complete: async () => {
        deleteCalls += 1
        if (deleteCalls === 1) {
          return JSON.stringify({
            timeLabel: null,
            objectTypes: [],
            behaviorHints: [],
            noteHint: false,
            contentTerms: [],
            intent: 'instruction',
            assistantReply: deleteOriginal,
            confidence: 'low'
          })
        }
        return '好的，交给我吧。'
      },
      useCache: false,
      trace: vi.fn()
    })
    expect(deleteParsed.assistantReply).toBe(deleteOriginal)

    const fresh = '阳光挺好的——要找你存过的什么吗？'
    const ok = await parseRecallClueWithLlm('今天天气不错', {
      complete: makeSecond(fresh),
      useCache: false
    })
    expect(ok.assistantReply).toBe(fresh)
  })
})
