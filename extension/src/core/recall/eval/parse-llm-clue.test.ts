import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  extractJsonObjectText,
  parseJsonObjectFromLlmText
} from '@/core/recall/understand/extract-llm-json'
import { buildChitchatReplyMessages } from '@/core/recall/understand/build-chitchat-reply-prompt'
import { clearLlmParseCache, setCachedLlmParse } from '@/core/recall/understand/llm-parse-cache'
import { LlmParsedClueProposalSchema } from '@/core/recall/understand/llm-parsed-clue-proposal'
import { mapLlmProposalToParsedClue } from '@/core/recall/understand/map-llm-proposal-to-parsed'
import { PARSE_GOLD_NOW_MS } from '@/core/recall/eval/parse-gold-now'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { parseRecallClueWithLlm } from '@/core/recall/understand/parse-recall-clue-with-llm'
import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'
import type { LlmChatCompleteOptions } from '@/core/recall/understand/ai-chat-task-kind'

describe('extract-llm-json', () => {
  it('剥 markdown 围栏', () => {
    expect(extractJsonObjectText('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('从前后废话中取对象', () => {
    expect(
      parseJsonObjectFromLlmText('Here you go:\n{"contentTerms":[],"confidence":"low"}\n')
    ).toEqual({
      contentTerms: [],
      confidence: 'low'
    })
  })
})

describe('mapLlmProposalToParsedClue', () => {
  it('timeLabel → 确定性 timeRange；短语 contentTerms 拆 token', () => {
    const parsed = mapLlmProposalToParsedClue(
      'yesterday poem',
      {
        timeLabel: 'yesterday',
        objectTypes: ['poem'],
        contentTerms: ['Li Bai'],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.timeRange?.label).toBe('yesterday')
    expect(parsed.objectTypes).toEqual(['poem'])
    expect(parsed.contentTerms).toEqual(['li', 'bai'])
    // 忽略模型 confidence：time+type+content → high
    expect(parsed.confidence).toBe('high')
  })

  it('刚存书签：模型漏槽+虚词残留仍落到约束邻域槽位', () => {
    const parsed = mapLlmProposalToParsedClue(
      'just saved bookmark',
      {
        timeLabel: null,
        objectTypes: null,
        behaviorHints: null,
        contentTerms: ['just', 'saved', 'bookmark'],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.objectTypes).toEqual(['bookmark'])
    expect(parsed.behaviorHints).toEqual(['recently_saved'])
    expect(parsed.contentTerms).toEqual([])
  })

  it('无内容词时 confidence 与规则一致为 medium', () => {
    const parsed = mapLlmProposalToParsedClue(
      'the song I played on repeat yesterday',
      {
        timeLabel: 'yesterday',
        objectTypes: ['song'],
        behaviorHints: ['often_opened'],
        contentTerms: [],
        confidence: 'high'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.confidence).toBe('medium')
  })

  it('无词面支撑的 recently_saved / 臆造类型会被剥掉', () => {
    const onlyTime = mapLlmProposalToParsedClue(
      'yesterday saved that',
      {
        timeLabel: 'yesterday',
        behaviorHints: ['recently_saved'],
        contentTerms: [],
        confidence: 'high'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(onlyTime.behaviorHints).toBeUndefined()
    expect(onlyTime.confidence).toBe('low')

    const bareProduct = mapLlmProposalToParsedClue(
      'Cloudflare Workers',
      {
        objectTypes: ['code'],
        contentTerms: ['cloudflare workers'],
        confidence: 'medium'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(bareProduct.objectTypes).toBeUndefined()
    expect(bareProduct.contentTerms).toEqual(['cloudflare', 'workers'])
    expect(bareProduct.confidence).toBe('low')
  })

  it('公历年份（1954）不得被 LLM 误采纳为 long_ago timeLabel', () => {
    const parsed = mapLlmProposalToParsedClue(
      'Gregory Peck million pound note 1954',
      {
        timeLabel: 'long_ago',
        objectTypes: null,
        behaviorHints: null,
        contentTerms: ['gregory', 'peck', 'million', 'pound', 'note', '1954'],
        confidence: 'medium'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.timeRange).toBeUndefined()
    expect(parsed.contentTerms).toEqual(
      expect.arrayContaining(['gregory', 'peck', 'million', 'pound', '1954'])
    )
    expect(parsed.contentTerms).not.toContain('note')
  })

  it('verse 别名可支撑 poem，并从 contentTerms 剥离；the other day→recent', () => {
    const parsed = mapLlmProposalToParsedClue(
      'that Li Bai verse from the other day',
      {
        timeLabel: 'a_while_ago',
        objectTypes: ['poem'],
        contentTerms: ['li', 'bai', 'verse', 'from'],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.timeRange?.label).toBe('recent')
    expect(parsed.objectTypes).toEqual(['poem'])
    expect(parsed.contentTerms).toEqual(['li', 'bai'])
    expect(parsed.confidence).toBe('high')
  })

  it('soft「old」无相对时间词面时不得采纳 LLM timeLabel', () => {
    const parsed = mapLlmProposalToParsedClue(
      'that old DPR paper on arxiv',
      {
        timeLabel: 'a_while_ago',
        objectTypes: ['article'],
        contentTerms: ['dpr', 'paper', 'arxiv'],
        confidence: 'medium'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.timeRange).toBeUndefined()
    expect(parsed.contentTerms).toEqual(expect.arrayContaining(['dpr', 'arxiv']))
  })

  it('词典命中 few months back 时纠偏错误 LLM timeLabel', () => {
    const parsed = mapLlmProposalToParsedClue(
      'something about public libraries i saved a few months back',
      {
        timeLabel: 'a_while_ago',
        objectTypes: null,
        behaviorHints: null,
        contentTerms: ['public', 'libraries'],
        confidence: 'medium'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.timeRange?.label).toBe('few_months_ago')
    expect(parsed.contentTerms).toEqual(expect.arrayContaining(['public', 'libraries']))
  })

  it('chitchat 提议 → intent 为 chitchat，assistantReply 原样透传', () => {
    const reply = 'Yeah, lovely day — looking for something you saved?'
    const parsed = mapLlmProposalToParsedClue(
      'nice weather today',
      {
        timeLabel: null,
        objectTypes: [],
        behaviorHints: [],
        contentTerms: [],
        intent: 'chitchat',
        assistantReply: reply,
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.intent).toBe('chitchat')
    expect(parsed.assistantReply).toBe(reply)
  })

  it('recall 提议 → 无 intent 字段、无 assistantReply', () => {
    const parsed = mapLlmProposalToParsedClue(
      'yesterday poem',
      {
        timeLabel: 'yesterday',
        objectTypes: ['poem'],
        contentTerms: [],
        intent: 'recall',
        confidence: 'medium'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.intent).toBeUndefined()
    expect(parsed.assistantReply).toBeUndefined()
  })

  it('recall 提议带多余 assistantReply → 回复被剥掉', () => {
    const parsed = mapLlmProposalToParsedClue(
      'yesterday poem',
      {
        timeLabel: 'yesterday',
        objectTypes: ['poem'],
        contentTerms: [],
        intent: 'recall',
        assistantReply: 'Should not appear',
        confidence: 'medium'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.intent).toBeUndefined()
    expect(parsed.assistantReply).toBeUndefined()
  })

  it('chitchat 提议无 assistantReply → intent 为 chitchat、无 reply', () => {
    const parsed = mapLlmProposalToParsedClue(
      'hello',
      {
        timeLabel: null,
        objectTypes: [],
        contentTerms: [],
        intent: 'chitchat',
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.intent).toBe('chitchat')
    expect(parsed.assistantReply).toBeUndefined()
  })

  it('超长 reply（>280 字符）→ 截断到 280 字符', () => {
    const longReply = 'a'.repeat(300)
    const parsed = mapLlmProposalToParsedClue(
      'hello',
      {
        timeLabel: null,
        objectTypes: [],
        contentTerms: [],
        intent: 'chitchat',
        assistantReply: longReply,
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.assistantReply).toBe('a'.repeat(280))
    expect(parsed.assistantReply?.length).toBe(280)
  })
})

describe('parseRecallClueWithLlm · verse 主词典（mock）', () => {
  it('mock：verse 线索映射为 poem；规则路径同认 poem', async () => {
    const complete: LlmChatCompleter = async messages => {
      const user = messages.find(item => item.role === 'user')?.content ?? ''
      const clue = user.replace(/^Clue:\n/, '')

      if (clue.includes('verse')) {
        return JSON.stringify({
          timeLabel: 'recent',
          objectTypes: ['poem'],
          behaviorHints: null,
          noteHint: false,
          contentTerms: ['li', 'bai'],
          confidence: 'high'
        })
      }

      return JSON.stringify({
        timeLabel: null,
        objectTypes: null,
        contentTerms: [],
        confidence: 'low'
      })
    }

    const clue = 'that Li Bai verse from the other day'
    const parsed = await parseRecallClueWithLlm(clue, { complete })
    expect(parsed.objectTypes).toEqual(['poem'])
    expect(parsed.contentTerms).toEqual(['li', 'bai'])

    // 规则路径：verse 已并入主词典 → poem（不再依赖已退役 compare-parse-gold）
    const rules = parseRecallClue(clue, { nowMs: PARSE_GOLD_NOW_MS })
    expect(rules.objectTypes).toContain('poem')
  })

  it('mock：chitchat JSON → intent chitchat + 非空 assistantReply', async () => {
    const complete: LlmChatCompleter = async () =>
      JSON.stringify({
        timeLabel: null,
        objectTypes: [],
        behaviorHints: [],
        noteHint: false,
        contentTerms: [],
        intent: 'chitchat',
        assistantReply: '天气是不错——有什么想找的吗？',
        confidence: 'low'
      })

    const parsed = await parseRecallClueWithLlm('今天天气不错', { complete })
    expect(parsed.intent).toBe('chitchat')
    expect(parsed.assistantReply?.trim().length).toBeGreaterThan(0)
  })
})

describe('parseRecallClueWithLlm · 闲聊回复第二次调用', () => {
  beforeEach(() => {
    clearLlmParseCache()
  })

  afterEach(() => {
    clearLlmParseCache()
  })

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

  it('chitchat 新解析调 2 次，第 2 次 temperature 0.8，返回第 2 次回复', async () => {
    const calls: Array<{
      options: LlmChatCompleteOptions
      messages: Array<{ role: string; content: string }>
    }> = []
    const freshReply = '阳光挺好的——要找你存过的什么吗？'
    const complete: LlmChatCompleter = async (messages, options) => {
      calls.push({ options, messages })
      if (calls.length === 1) {
        return chitchatProposalJson('天气不错哦，想找点什么吗？')
      }
      return freshReply
    }

    const parsed = await parseRecallClueWithLlm('今天天气不错', { complete })
    expect(calls).toHaveLength(2)
    expect(calls[1]?.options).toEqual({ taskKind: 'nlu', temperature: 0.8 })
    expect(parsed.intent).toBe('chitchat')
    expect(parsed.assistantReply).toBe(freshReply)
  })

  it('缓存命中 chitchat 也调第 2 次，prompt 含缓存回复作换说法提示', async () => {
    const cachedReply = '天气不错哦，想找点什么吗？'
    const freshReply = '挺暖和的——有存过的东西要找吗？'
    const clue = '今天天气不错'
    setCachedLlmParse(
      clue,
      LlmParsedClueProposalSchema.parse({
        timeLabel: null,
        objectTypes: [],
        behaviorHints: [],
        noteHint: false,
        contentTerms: [],
        intent: 'chitchat',
        assistantReply: cachedReply,
        confidence: 'low'
      })
    )

    let callCount = 0
    let replyMessages: Array<{ role: string; content: string }> = []
    const complete: LlmChatCompleter = async (messages, options) => {
      callCount += 1
      expect(options).toEqual({ taskKind: 'nlu', temperature: 0.8 })
      replyMessages = messages
      return freshReply
    }

    const parsed = await parseRecallClueWithLlm(clue, { complete })
    expect(callCount).toBe(1)
    expect(replyMessages.some(m => m.content.includes(cachedReply))).toBe(true)
    expect(replyMessages.some(m => m.content.includes('say it differently'))).toBe(true)
    expect(parsed.assistantReply).toBe(freshReply)
  })

  it('回复调用抛错/超时/空回复时回落提议原回复，解析不抛错', async () => {
    const originalReply = '天气不错——有想找的吗？'

    const makeFailing = (second: () => Promise<string>): LlmChatCompleter => {
      let n = 0
      return async () => {
        n += 1
        if (n === 1) {
          return chitchatProposalJson(originalReply)
        }
        return second()
      }
    }

    const errorParsed = await parseRecallClueWithLlm('今天天气不错', {
      complete: makeFailing(async () => {
        throw new Error('boom')
      }),
      useCache: false
    })
    expect(errorParsed.intent).toBe('chitchat')
    expect(errorParsed.assistantReply).toBe(originalReply)

    const timeoutErr = new Error('aborted')
    timeoutErr.name = 'TimeoutError'
    const timeoutParsed = await parseRecallClueWithLlm('今天天气不错', {
      complete: makeFailing(async () => {
        throw timeoutErr
      }),
      useCache: false
    })
    expect(timeoutParsed.assistantReply).toBe(originalReply)

    const emptyParsed = await parseRecallClueWithLlm('今天天气不错', {
      complete: makeFailing(async () => '   '),
      useCache: false
    })
    expect(emptyParsed.assistantReply).toBe(originalReply)
  })

  it('recall 输入只调 1 次（无第 2 次调用）', async () => {
    let callCount = 0
    const complete: LlmChatCompleter = async (_messages, options) => {
      callCount += 1
      expect(options).toEqual({ taskKind: 'nlu' })
      return JSON.stringify({
        timeLabel: 'yesterday',
        objectTypes: ['poem'],
        behaviorHints: null,
        noteHint: false,
        contentTerms: [],
        intent: 'recall',
        confidence: 'medium'
      })
    }

    const parsed = await parseRecallClueWithLlm('yesterday poem', {
      complete,
      useCache: false
    })
    expect(callCount).toBe(1)
    expect(parsed.intent).toBeUndefined()
    expect(parsed.objectTypes).toEqual(['poem'])
  })

  it('回复调用的 messages 含身份行与 clue 原文', async () => {
    let replyMessages: Array<{ role: string; content: string }> = []
    const complete: LlmChatCompleter = async (messages, options) => {
      if (options.temperature === 0.8) {
        replyMessages = messages
        return '换个说法——要找存过的东西吗？'
      }
      return chitchatProposalJson('原回复')
    }

    await parseRecallClueWithLlm('今天天气不错', { complete, useCache: false })
    const system = replyMessages.find(m => m.role === 'system')?.content ?? ''
    const user = replyMessages.find(m => m.role === 'user')?.content ?? ''
    expect(system).toContain('You are Yiveno')
    expect(user).toBe('Clue:\n今天天气不错')
  })

  it('回复 prompt 的 system 含身份 Yiveno / 奇忆 / finds things', () => {
    const messages = buildChitchatReplyMessages('你叫什么')
    const system = messages.find(m => m.role === 'system')?.content ?? ''
    expect(system).toContain('Yiveno')
    expect(system).toContain('奇忆')
    expect(system).toContain('finds things')
  })

  it('回复 prompt 含乱写诚实规则与禁脑补', () => {
    const messages = buildChitchatReplyMessages('啊上课了大街上')
    const system = messages.find(m => m.role === 'system')?.content ?? ''
    expect(system).toContain('Incoherent, accidental, voice-mess, or nonsense')
    expect(system).toContain('do not invent a mood')
    expect(system).toContain('啊上课了大街上')
    expect(system).toContain('你今天挺忙')
  })

  it('身份提问走回复调用且 system 含奇忆', async () => {
    const calls: Array<{
      options: LlmChatCompleteOptions
      messages: Array<{ role: string; content: string }>
    }> = []
    const identityReply = '我是奇忆，帮你找你想要的东西——想到什么就说。'
    const complete: LlmChatCompleter = async (messages, options) => {
      calls.push({ options, messages })
      if (calls.length === 1) {
        return chitchatProposalJson('我是找东西的。')
      }
      return identityReply
    }

    const parsed = await parseRecallClueWithLlm('你叫什么', { complete, useCache: false })
    expect(calls).toHaveLength(2)
    const replySystem = calls[1]?.messages.find(m => m.role === 'system')?.content ?? ''
    expect(replySystem).toContain('奇忆')
    expect(parsed.intent).toBe('chitchat')
    expect(parsed.assistantReply).toBe(identityReply)
  })
})
