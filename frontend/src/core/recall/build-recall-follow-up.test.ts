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
})
