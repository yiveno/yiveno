import { describe, expect, it } from 'vitest'

import { PARSE_GOLD_NOW_MS } from '@/core/recall/eval/parse-gold-now'
import { shouldSkipRecallAsZeroAnchor } from '@/core/recall/orchestrate-keyword-recall'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { classifyRulesClueIntent } from '@/core/recall/understand/classify-rules-clue-intent'
import { understandRecallClue } from '@/core/recall/understand/understand-recall-clue'

function judge(clue: string) {
  const parsed = parseRecallClue(clue, { nowMs: PARSE_GOLD_NOW_MS })
  return classifyRulesClueIntent(clue.trim(), parsed)
}

describe('classifyRulesClueIntent', () => {
  it('问号 + 无类型 → question', () => {
    for (const clue of [
      '法国首都是哪？',
      '今天星期几？',
      "what's the capital of Japan?",
      '水在多少度结冰？'
    ]) {
      const result = judge(clue)
      expect(result?.intent, clue).toBe('question')
      expect(result?.assistantReply?.trim().length, clue).toBeGreaterThan(0)
    }
  })

  it('既有英文情绪词面 → chitchat', () => {
    const result = judge('i feel bored')
    expect(result?.intent).toBe('chitchat')
    expect(result?.assistantReply?.trim().length).toBeGreaterThan(0)
  })

  it('中文指令词面 → instruction', () => {
    for (const clue of [
      '提醒我下午三点打电话',
      '提醒我明天开会',
      '写首诗',
      '把书签全删了',
      '翻译这句话'
    ]) {
      const result = judge(clue)
      expect(result?.intent, clue).toBe('instruction')
      expect(result?.assistantReply?.trim().length, clue).toBeGreaterThan(0)
    }
  })

  it('中文创作构造变体 → instruction', () => {
    for (const clue of ['写一首关于秋天的诗', '写一篇文章', '写一封信', '写一段话']) {
      const result = judge(clue)
      expect(result?.intent, clue).toBe('instruction')
    }
  })

  it('中文翻译构造变体 → instruction', () => {
    for (const clue of ['翻译这段话', '翻译一下这篇文章', '翻译那个句子', '翻译一篇文章']) {
      const result = judge(clue)
      expect(result?.intent, clue).toBe('instruction')
    }
  })

  it('中文构造的召回对照不拦截', () => {
    for (const clue of [
      '昨天写的那首诗',
      '写诗比赛的文章',
      '翻译过的那篇文章',
      '我昨天翻译了一篇文章'
    ]) {
      expect(judge(clue), clue).toBeNull()
    }
  })

  it('点餐/用餐构造变体 → instruction', () => {
    for (const clue of [
      'order me a coffee',
      'order a coffee',
      'order some food',
      'what should I eat for dinner',
      'what to eat tonight'
    ]) {
      const result = judge(clue)
      expect(result?.intent, clue).toBe('instruction')
    }
  })

  it('点餐/用餐构造的召回对照不拦截', () => {
    for (const clue of [
      'my order history',
      'the order confirmation I saved',
      'the article about cooking for dinner'
    ]) {
      expect(judge(clue), clue).toBeNull()
    }
  })

  it('召回金标 12 条一律不拦截', () => {
    for (const clue of [
      'yesterday poem',
      'yesterday poem about Li Bai',
      '昨天那个东西',
      '我昨天看到一个东西',
      'the article I read last week',
      'my password for github',
      'that song I kept listening to',
      '今天天气不错，顺便找找昨天的诗',
      '昨天天气不错，我看到一首诗',
      'hello, find me that poem from yesterday',
      '你是什么时候保存的那篇文章',
      '介绍一下昨天那首诗'
    ]) {
      expect(judge(clue), clue).toBeNull()
    }
  })

  it('未覆盖的闲聊 9 条一律不拦截（作用域锁定）', () => {
    // 有意的未覆盖，不是遗漏；若以后加问候集，本测试须同步改
    for (const clue of [
      '今天天气不错',
      'nice weather today',
      'hello',
      'hi there',
      '你好',
      'how are you',
      'good morning',
      "I'm so tired today",
      '今天过得怎么样'
    ]) {
      expect(judge(clue), clue).toBeNull()
    }
  })

  it('含词面但有召回锚的召回对照不拦截', () => {
    for (const clue of [
      '昨天写的那首诗',
      '翻译过的那篇文章',
      '昨天删掉的那篇文章', // 时间守卫
      'weather article I saved',
      'translate this article I saved' // 召回锚守卫
    ]) {
      expect(judge(clue), clue).toBeNull()
    }
  })

  it('已知边缘：仅时间问号召回问被判 question', () => {
    // 已知边缘：失败路径的诚实降级回复比一次可能错误的检索可接受
    const result = judge('昨天那个东西是什么？')
    expect(result?.intent).toBe('question')
  })

  it('回复语言跟随线索语言', () => {
    const zh = judge('法国首都是哪？')
    expect(zh?.assistantReply).toContain('理解服务现在连不上')
    const en = judge("what's the capital of Japan?")
    expect(en?.assistantReply).toContain('understanding service')
  })

  it('Omnibox 跳过规则意图', async () => {
    const result = await understandRecallClue('法国首都是哪？', {
      forceMode: 'lexical',
      skipRulesIntent: true
    })
    expect(result.source).toBe('rules')
    expect(result.parsed.intent).toBeUndefined()
  })

  it('无 completer 与 LLM 抛错两路都走规则意图', async () => {
    const noCompleter = await understandRecallClue('法国首都是哪？')
    expect(noCompleter.source).toBe('rules')
    expect(noCompleter.parsed.intent).toBe('question')

    const fallback = await understandRecallClue('法国首都是哪？', {
      complete: async () => {
        throw new Error('boom')
      }
    })
    expect(fallback.source).toBe('rules_fallback')
    expect(fallback.parsed.intent).toBe('question')
  })

  it('情绪词不再单列：i feel bored 按正常召回处理', () => {
    // 不再把 bored 当「无强锚」特例剥掉；有无聊相关条目就找，没有就诚实 no_match
    const parsed = parseRecallClue('i feel bored', { nowMs: PARSE_GOLD_NOW_MS })
    expect(shouldSkipRecallAsZeroAnchor('i feel bored', parsed)).toBe(false)
  })
})
