import { describe, expect, it } from 'vitest'

import { PARSE_GOLD_NOW_MS } from '../../../../tests/eval/parse-gold-now'
import { buildLlmParseClueMessages } from '@/core/recall/understand/build-llm-parse-prompt'
import { mapLlmProposalToParsedClue } from '@/core/recall/understand/map-llm-proposal-to-parsed'
import { shouldReclassifyQuestionAsRecall } from '@/core/recall/understand/reclassify-question-as-recall'

describe('shouldReclassifyQuestionAsRecall', () => {
  it('问功能/软件/文章/视频「哪个来着」+ 已有槽位 → 改判', () => {
    const cases = [
      {
        clue: '有个可以把手机照片里面的人或者东西抠出来，然后贴到另外一张图片里的功能，苹果自带的还是哪个软件来着。',
        contentTerms: ['苹果', '抠'],
        objectTypeOther: '功能'
      },
      {
        clue: '那个可以把背景虚化的软件是哪个来着',
        contentTerms: ['虚化'],
        objectTypeOther: '软件'
      },
      {
        clue: '之前看过一篇讲迁徙的文章是哪个来着',
        contentTerms: ['迁徙'],
        objectTypeOther: null
      },
      {
        clue: '收藏过一个讲气候变化的视频，哪个来着',
        contentTerms: ['气候', '变化'],
        objectTypeOther: null
      }
    ] as const
    for (const row of cases) {
      expect(
        shouldReclassifyQuestionAsRecall({
          clue: row.clue,
          intent: 'question',
          contentTerms: [...row.contentTerms],
          objectTypeOther: row.objectTypeOther
        }),
        row.clue
      ).toBe(true)
    }
  })

  it('真事实问题 / 无槽位 question → 不改判', () => {
    expect(
      shouldReclassifyQuestionAsRecall({
        clue: '谁写了红楼梦',
        intent: 'question',
        contentTerms: [],
        objectTypeOther: null
      })
    ).toBe(false)
    expect(
      shouldReclassifyQuestionAsRecall({
        clue: 'what is the boiling point of water',
        intent: 'question',
        contentTerms: ['boiling', 'point', 'water'],
        objectTypeOther: null
      })
    ).toBe(false)
    expect(
      shouldReclassifyQuestionAsRecall({
        clue: '有个功能哪个来着',
        intent: 'question',
        contentTerms: [],
        objectTypeOther: null
      })
    ).toBe(false)
  })

  it('非 question intent → 不改判', () => {
    expect(
      shouldReclassifyQuestionAsRecall({
        clue: '有个功能哪个来着',
        intent: 'recall',
        contentTerms: ['功能'],
        objectTypeOther: null
      })
    ).toBe(false)
  })
})

describe('mapLlmProposalToParsedClue · 问句式召回护栏', () => {
  it('LLM 判 question 但有槽位+找回锚 → intent=recall 且清空 assistantReply', () => {
    const clue =
      '有个可以把手机照片里面的人或者东西抠出来，然后贴到另外一张图片里的功能，苹果自带的还是哪个软件来着。'
    const parsed = mapLlmProposalToParsedClue(
      clue,
      {
        timeLabel: null,
        objectTypes: null,
        objectTypeOther: '功能',
        contentTerms: ['苹果', '照片', '抠'],
        confidence: 'medium',
        intent: 'question',
        assistantReply: '那是 iOS 的「抠图」功能……'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.intent ?? 'recall').toBe('recall')
    expect(parsed.assistantReply).toBeUndefined()
    expect(parsed.contentTerms.length).toBeGreaterThan(0)
  })

  it('真事实问题仍保留 question + assistantReply', () => {
    const parsed = mapLlmProposalToParsedClue(
      '谁写了红楼梦',
      {
        timeLabel: null,
        objectTypes: null,
        contentTerms: [],
        confidence: 'high',
        intent: 'question',
        assistantReply: '曹雪芹。想找相关存档也可以说一声。'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.intent).toBe('question')
    expect(parsed.assistantReply).toContain('曹雪芹')
  })

  it('prompt 强调问句式找回是 recall', () => {
    const system = buildLlmParseClueMessages('clue').find(m => m.role === 'system')?.content ?? ''
    expect(system).toMatch(/哪个来着|which one/i)
    expect(system).toMatch(/ALWAYS recall/i)
  })
})
