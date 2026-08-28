import { describe, expect, it } from 'vitest'

import {
  MEMORY_ENRICHMENT_PROPOSAL_JSON_SHAPE,
  parseMemoryEnrichmentProposal
} from '@/core/memory/memory-enrichment-proposal'
import {
  applyMergedEnrichmentToClues,
  mergeMemoryClueEnrichment
} from '@/core/memory/merge-memory-clue-enrichment'

describe('parseMemoryEnrichmentProposal', () => {
  it('解析纯 JSON 对象', () => {
    expect(
      parseMemoryEnrichmentProposal({
        objectType: 'video',
        keywords: ['wwii', ' WWII ', 'Hitler'],
        entities: ['Hitler'],
        summary: 'BBC documentary about Hitler legacy'
      })
    ).toEqual({
      objectType: 'video',
      keywords: ['wwii', 'Hitler'],
      entities: ['Hitler'],
      summary: 'BBC documentary about Hitler legacy'
    })
  })

  it('解析 markdown 围栏并丢弃非法 objectType', () => {
    const raw = `\`\`\`json
{"objectType":"film","keywords":["war"],"tags":["video"]}
\`\`\``
    expect(parseMemoryEnrichmentProposal(raw)).toBeNull()
  })

  it('非法字段（strict）失败', () => {
    expect(parseMemoryEnrichmentProposal({ keywords: ['a'], note: 'hack' })).toBeNull()
  })

  it('JSON shape 常量可供 LLM prompt 引用', () => {
    expect(MEMORY_ENRICHMENT_PROPOSAL_JSON_SHAPE).toContain('"keywords"')
  })
})

describe('mergeMemoryClueEnrichment', () => {
  const rule = {
    tags: ['video'],
    keywords: ['video', 'youtube', 'wwii'],
    entities: ['Hitler']
  }

  it('仅规则：与 existing 并集', () => {
    expect(
      mergeMemoryClueEnrichment({
        existing: { tags: ['mine'], keywords: ['Video'], entities: [] },
        rule
      })
    ).toEqual({
      tags: ['mine', 'video'],
      keywords: ['Video', 'youtube', 'wwii'],
      entities: ['Hitler']
    })
  })

  it('LLM 提议补词；objectType 进 tags；不覆盖已有 summary', () => {
    const merged = mergeMemoryClueEnrichment({
      existing: {
        tags: ['video'],
        keywords: ['video'],
        entities: ['Hitler'],
        summary: 'user kept summary'
      },
      rule,
      proposal: {
        objectType: 'video',
        keywords: ['war', 'documentary'],
        entities: ['BBC'],
        summary: 'model wants overwrite'
      }
    })
    expect(merged.tags).toEqual(['video'])
    expect(merged.keywords).toEqual(
      expect.arrayContaining(['video', 'youtube', 'wwii', 'war', 'documentary'])
    )
    expect(merged.entities).toEqual(expect.arrayContaining(['Hitler', 'BBC']))
    expect(merged.summary).toBeUndefined()
  })

  it('空 summary 槽可写入 proposal.summary', () => {
    const merged = mergeMemoryClueEnrichment({
      rule,
      proposal: { summary: 'Short recall hook about WWII video' }
    })
    expect(merged.summary).toBe('Short recall hook about WWII video')
  })

  it('applyMergedEnrichmentToClues 不碰 note', () => {
    const next = applyMergedEnrichmentToClues(
      { tags: [], keywords: [], entities: [], note: 'keep me', summary: undefined },
      {
        tags: ['video'],
        keywords: ['wwii'],
        entities: ['Hitler'],
        summary: 'hook'
      }
    )
    expect(next).toEqual({
      tags: ['video'],
      keywords: ['wwii'],
      entities: ['Hitler'],
      note: 'keep me',
      summary: 'hook'
    })
  })
})
