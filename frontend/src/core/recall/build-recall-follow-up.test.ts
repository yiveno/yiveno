import { describe, expect, it } from 'vitest'

import {
  buildRecallFollowUpPlan,
  listMissingRecallSlots,
  pickPrimaryFollowUpSlot
} from '@/core/recall/build-recall-follow-up'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'

const NOW_MS = Date.parse('2026-07-28T12:00:00.000Z')

describe('listMissingRecallSlots / pickPrimaryFollowUpSlot', () => {
  it('口语无结构锚点时主追问时间（可有残留 contentTerms）', () => {
    const parsed = parseRecallClue('好无聊想看点东西', { nowMs: NOW_MS })
    const missing = listMissingRecallSlots(parsed)
    expect(missing).toEqual(expect.arrayContaining(['time', 'objectType', 'note']))
    expect(missing).not.toContain('content')
    expect(pickPrimaryFollowUpSlot(missing)).toBe('time')
    expect(buildRecallFollowUpPlan(parsed, 'need_a_clue').replyKey).toBe(
      'popup_followup_uncertain_time'
    )
  })

  it('yesterday Li Bai poem → 槽较全，仅可能缺 note', () => {
    const parsed = parseRecallClue('i yesterday saved a poem about Li Bai', { nowMs: NOW_MS })
    const missing = listMissingRecallSlots(parsed)
    expect(missing).toEqual(['note'])
    expect(pickPrimaryFollowUpSlot(missing)).toBe('note')
  })

  it('只有内容词 → 主追问时间', () => {
    const parsed = parseRecallClue('Li Bai poem', { nowMs: NOW_MS })
    const plan = buildRecallFollowUpPlan(parsed, 'need_a_clue')
    expect(plan.primarySlot).toBe('time')
    expect(plan.replyKey).toBe('popup_followup_uncertain_time')
    expect(plan.suggestions.map(item => item.id)).toEqual(
      expect.arrayContaining(['time-yesterday', 'time-last-week'])
    )
  })

  it("a while ago didn't finish reading the article → 缺内容，主追问 content", () => {
    const parsed = parseRecallClue("the article I didn't finish reading a while ago", {
      nowMs: NOW_MS
    })
    const plan = buildRecallFollowUpPlan(parsed, 'no_match')
    expect(plan.primarySlot).toBe('content')
    expect(plan.replyKey).toBe('popup_followup_miss_content')
  })

  it('need_a_clue 与 no_match 文案 key 前缀不同', () => {
    const parsed = parseRecallClue('yesterday the article', { nowMs: NOW_MS })
    expect(buildRecallFollowUpPlan(parsed, 'need_a_clue').replyKey).toBe(
      'popup_followup_uncertain_content'
    )
    expect(buildRecallFollowUpPlan(parsed, 'no_match').replyKey).toBe('popup_followup_miss_content')
  })

  it('已有 objectTypes 时不再追问类型（电影危机回归）', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    expect(parsed.objectTypes).toEqual(['video'])
    const plan = buildRecallFollowUpPlan(parsed, 'no_match')
    expect(plan.primarySlot).not.toBe('objectType')
    expect(plan.replyKey).not.toMatch(/_type$/)
    expect(plan.suggestions.map(item => item.id).join(',')).not.toContain('type-article')
  })

  it('约束下库空：事实文案 + 仅换时间芯片', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    const plan = buildRecallFollowUpPlan(parsed, 'no_match', {
      emptyKind: 'constrained_none',
      hasRelatedGuess: true
    })
    expect(plan.replyKey).toBe('popup_followup_miss_constrained_empty_with_guess')
    expect(plan.primarySlot).toBe('time')
    expect(plan.suggestions.every(item => item.id.startsWith('time-'))).toBe(true)
  })

  it('电影 locale alias → video', () => {
    const parsed = parseRecallClue('昨天看过的电影', { nowMs: NOW_MS })
    expect(parsed.objectTypes).toEqual(['video'])
    const plan = buildRecallFollowUpPlan(parsed, 'no_match')
    expect(plan.primarySlot).not.toBe('objectType')
  })
})
