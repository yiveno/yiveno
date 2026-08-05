import { describe, expect, it } from 'vitest'

import {
  buildEffectiveRecallRaw,
  excludeDismissedMemoryItems,
  mergeDialogUtterances,
  mergeParsedRecallClues,
  mergeRecallDialogTurn,
  rollbackLastDialogUtterance,
  unionUniqueStrings
} from '@/core/recall/merge-recall-dialog-turn'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'

const NOW_MS = Date.parse('2026-08-05T12:00:00.000Z')

describe('unionUniqueStrings', () => {
  it('去重且保持先出现顺序', () => {
    expect(unionUniqueStrings(['Li Bai', 'poem'], ['poem', 'auth'])).toEqual([
      'Li Bai',
      'poem',
      'auth'
    ])
  })
})

describe('buildEffectiveRecallRaw', () => {
  it('拼接 prior + 本轮', () => {
    expect(buildEffectiveRecallRaw(['the poem about Li Bai'], 'yesterday')).toBe(
      'the poem about Li Bai yesterday'
    )
  })
})

describe('mergeParsedRecallClues / mergeRecallDialogTurn', () => {
  it('首轮：无 accumulated → initial', () => {
    const current = parseRecallClue('yesterday saved a poem about Li Bai', { nowMs: NOW_MS })
    const result = mergeRecallDialogTurn({
      accumulated: null,
      currentParsed: current,
      priorUserUtterances: [],
      currentUtterance: 'yesterday saved a poem about Li Bai'
    })
    expect(result.mergeMode).toBe('initial')
    expect(result.merged.contentTerms.length).toBeGreaterThan(0)
    expect(result.merged.objectTypes).toContain('poem')
    expect(result.merged.timeRange?.label).toBe('yesterday')
  })

  it('短补充 yesterday 保留 prior poem + content', () => {
    const turn1 = parseRecallClue('the poem about Li Bai', { nowMs: NOW_MS })
    const turn2 = parseRecallClue('yesterday', { nowMs: NOW_MS })
    const result = mergeRecallDialogTurn({
      accumulated: turn1,
      currentParsed: turn2,
      priorUserUtterances: ['the poem about Li Bai'],
      currentUtterance: 'yesterday'
    })

    expect(result.mergeMode).toBe('refine')
    expect(result.effectiveRaw).toBe('the poem about Li Bai yesterday')
    expect(result.merged.objectTypes).toContain('poem')
    expect(result.merged.contentTerms.map(t => t.toLowerCase())).toEqual(
      expect.arrayContaining(['li', 'bai'])
    )
    expect(result.merged.timeRange?.label).toBe('yesterday')
  })

  it('本轮 objectTypes 覆盖 prior', () => {
    const accumulated = parseRecallClue('article about auth', { nowMs: NOW_MS })
    const current = parseRecallClue('code snippet', { nowMs: NOW_MS })
    const merged = mergeParsedRecallClues(accumulated, current, 'article about auth code snippet')
    expect(merged.objectTypes).toEqual(['code'])
    expect(merged.contentTerms.map(t => t.toLowerCase())).toEqual(expect.arrayContaining(['auth']))
  })

  it('noteHint OR；芯片 my note 叠到 prior', () => {
    const accumulated = parseRecallClue('the article about deployment', { nowMs: NOW_MS })
    const current = parseRecallClue('my note', { nowMs: NOW_MS })
    const result = mergeRecallDialogTurn({
      accumulated,
      currentParsed: current,
      priorUserUtterances: ['the article about deployment'],
      currentUtterance: 'my note'
    })
    expect(result.merged.noteHint).toBe(true)
    expect(result.merged.contentTerms.map(t => t.toLowerCase())).toEqual(
      expect.arrayContaining(['deployment'])
    )
  })

  it('合并后置信度按槽位重算（内容+时间+类型 → high）', () => {
    const turn1 = parseRecallClue('poem Li Bai', { nowMs: NOW_MS })
    expect(turn1.confidence).not.toBe('high')
    const turn2 = parseRecallClue('yesterday', { nowMs: NOW_MS })
    const merged = mergeRecallDialogTurn({
      accumulated: turn1,
      currentParsed: turn2,
      priorUserUtterances: ['poem Li Bai'],
      currentUtterance: 'yesterday'
    }).merged
    expect(merged.confidence).toBe('high')
  })
})

describe('excludeDismissedMemoryItems', () => {
  it('硬排除 dismissedIds', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(excludeDismissedMemoryItems(items, ['b']).map(i => i.id)).toEqual(['a', 'c'])
  })

  it('空列表不改动', () => {
    const items = [{ id: 'a' }]
    expect(excludeDismissedMemoryItems(items, undefined)).toEqual(items)
  })
})

describe('mergeDialogUtterances / rollbackLastDialogUtterance', () => {
  it('多轮 merge 保留类型与时间', () => {
    const turns = ['the poem about Li Bai', 'yesterday']
    const batch = mergeDialogUtterances(turns, { nowMs: NOW_MS })
    expect(batch.merged?.objectTypes).toContain('poem')
    expect(batch.merged?.timeRange?.label).toBe('yesterday')
    expect(batch.effectiveRaw).toBe('the poem about Li Bai yesterday')
  })

  it('rollback 丢掉末轮并重算 accumulated', () => {
    const afterTwo = mergeDialogUtterances(['poem Li Bai', 'yesterday'], { nowMs: NOW_MS })
    const rolled = rollbackLastDialogUtterance(
      {
        priorUserUtterances: ['poem Li Bai', 'yesterday'],
        accumulated: afterTwo.merged,
        dismissedIds: ['11111111-1111-4111-8111-111111111101']
      },
      { nowMs: NOW_MS }
    )
    expect(rolled.priorUserUtterances).toEqual(['poem Li Bai'])
    expect(rolled.accumulated?.timeRange).toBeUndefined()
    expect(rolled.accumulated?.objectTypes).toContain('poem')
    expect(rolled.dismissedIds).toEqual(['11111111-1111-4111-8111-111111111101'])
  })
})
