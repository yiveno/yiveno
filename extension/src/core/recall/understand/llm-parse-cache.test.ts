import { afterEach, describe, expect, it } from 'vitest'

import {
  clearLlmParseCache,
  getCachedLlmParse,
  getLlmParseCacheSize,
  LLM_PARSE_CACHE_MAX_ENTRIES,
  setCachedLlmParse
} from '@/core/recall/understand/llm-parse-cache'

const baseProposal = {
  timeLabel: null,
  objectTypes: null,
  contentTerms: ['cloudflare', 'workers'],
  confidence: 'high' as const
}

describe('llm-parse-cache', () => {
  afterEach(() => {
    clearLlmParseCache()
  })

  it('normalize：trim + lowercase 后命中', () => {
    setCachedLlmParse('  Cloudflare Workers  ', baseProposal, { nowMs: 1000 })
    expect(getCachedLlmParse('cloudflare workers', { nowMs: 1001 })).toEqual(baseProposal)
    expect(getCachedLlmParse('CLOUDFLARE WORKERS', { nowMs: 1001 })).toEqual(baseProposal)
  })

  it('miss：未写入返回 null', () => {
    expect(getCachedLlmParse('not cached', { nowMs: 1000 })).toBeNull()
  })

  it('miss：空字符串不入也不取', () => {
    setCachedLlmParse('   ', baseProposal, { nowMs: 1000 })
    expect(getLlmParseCacheSize()).toBe(0)
    expect(getCachedLlmParse('', { nowMs: 1000 })).toBeNull()
  })

  it('TTL：过期后 miss（默认 5min，可缩）', () => {
    setCachedLlmParse('cloudflare', baseProposal, { nowMs: 1000 })
    expect(getCachedLlmParse('cloudflare', { nowMs: 1000 + 60_000 })).toEqual(baseProposal)
    // 缩到 30s：61s 已过期
    expect(getCachedLlmParse('cloudflare', { nowMs: 1000 + 61_000, ttlMs: 30_000 })).toBeNull()
  })

  it('LRU：同 clue 再次写入刷新 insertedAt，且不挤掉自身', () => {
    setCachedLlmParse('a', baseProposal, { nowMs: 1000 })
    setCachedLlmParse('b', baseProposal, { nowMs: 1000 })
    expect(getLlmParseCacheSize()).toBe(2)
    // 再写 a：插入顺序移到尾部
    setCachedLlmParse('a', baseProposal, { nowMs: 5000 })
    expect(getLlmParseCacheSize()).toBe(2)
    // a 用新时间戳命中（证明 refreshed）
    expect(getCachedLlmParse('a', { nowMs: 5001 })).toEqual(baseProposal)
  })

  it('LRU 容量：满时丢最旧', () => {
    // 写满 max
    for (let i = 0; i < LLM_PARSE_CACHE_MAX_ENTRIES; i++) {
      setCachedLlmParse(`clue-${i}`, baseProposal, { nowMs: 1000 + i })
    }
    expect(getLlmParseCacheSize()).toBe(LLM_PARSE_CACHE_MAX_ENTRIES)
    // 再写一条：丢最旧（clue-0）
    setCachedLlmParse('clue-new', baseProposal, { nowMs: 9999 })
    expect(getLlmParseCacheSize()).toBe(LLM_PARSE_CACHE_MAX_ENTRIES)
    expect(getCachedLlmParse('clue-0', { nowMs: 2000 })).toBeNull()
    expect(getCachedLlmParse('clue-new', { nowMs: 2000 })).toEqual(baseProposal)
  })

  it('同 clue 大小写不敏感 + 复用：第二次走 cache 不再写', () => {
    setCachedLlmParse('Cloudflare', baseProposal, { nowMs: 1000 })
    expect(getCachedLlmParse('CLOUDFLARE', { nowMs: 1001 })).toEqual(baseProposal)
    // 写入是 idempotent：写同 clue 不增容量
    setCachedLlmParse('cloudflare', baseProposal, { nowMs: 1002 })
    expect(getLlmParseCacheSize()).toBe(1)
  })

  it('clearLlmParseCache：清空后全部 miss', () => {
    setCachedLlmParse('a', baseProposal, { nowMs: 1000 })
    setCachedLlmParse('b', baseProposal, { nowMs: 1000 })
    expect(getLlmParseCacheSize()).toBe(2)
    clearLlmParseCache()
    expect(getLlmParseCacheSize()).toBe(0)
    expect(getCachedLlmParse('a', { nowMs: 1001 })).toBeNull()
  })
})
