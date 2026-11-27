import { describe, expect, it } from 'vitest'

import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { mapLlmFollowUpProposal } from '@/core/recall/understand/map-llm-follow-up-proposal'

const NOW_MS = Date.parse('2026-08-08T12:00:00.000Z')

describe('mapLlmFollowUpProposal', () => {
  it('keeps a valid English follow-up reply and chip values', () => {
    const parsed = parseRecallClue('the article about RAG', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: 'These are the closest matches. Do you remember a word from the title?',
        chips: [
          { label: 'RAG', value: 'RAG' },
          { label: 'deploy', value: 'deploy' }
        ]
      },
      { parsed, outcome: 'need_a_clue' }
    )
    expect(mapped?.text).toContain('closest matches')
    expect(mapped?.suggestions.map(item => item.value)).toEqual(['RAG', 'deploy'])
  })

  it('rejects type questionnaire replies when objectTypes already exist', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: "I still haven't matched it. Was it an article, poem, code snippet, or song?",
        chips: [{ label: 'Article', value: 'article' }]
      },
      { parsed, outcome: 'need_a_clue' }
    )
    expect(mapped).toBeNull()
  })

  it('filters type chips but keeps valid non-type follow-up chips', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: 'Do you remember a word from the title?',
        chips: [
          { label: 'Article', value: 'article' },
          { label: 'Just saved', value: 'just saved' }
        ]
      },
      { parsed, outcome: 'need_a_clue' }
    )
    expect(mapped?.suggestions.map(item => item.value)).toEqual(['just saved'])
  })

  it('drops invalid chip values', () => {
    const parsed = parseRecallClue('Li Bai poem', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: 'Which title feels closer?',
        chips: [{ label: 'Full sentence', value: 'Is it the one I saved yesterday?' }]
      },
      { parsed, outcome: 'need_a_clue' }
    )
    expect(mapped?.suggestions).toEqual([])
  })

  it('drops non-cutting meta chips like I do not remember', () => {
    const parsed = parseRecallClue('the article about trust', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: 'Which detail feels closer?',
        chips: [
          { label: "I don't remember", value: "I don't remember" },
          { label: 'trust', value: 'trust' }
        ]
      },
      { parsed, outcome: 'need_a_clue' }
    )
    expect(mapped?.suggestions.map(item => item.value)).toEqual(['trust'])
  })

  it('rejects assistant-persona follow-up copy', () => {
    const parsed = parseRecallClue('the song I used to like most', { nowMs: NOW_MS })
    expect(
      mapLlmFollowUpProposal(
        {
          reply:
            "Sorry, I don't know your preferences yet. Tell me what you usually like and I'll remember it.",
          chips: []
        },
        { parsed, outcome: 'need_a_clue' }
      )
    ).toBeNull()
  })

  it('有弱候选标题时丢弃全标题共有词 chip，保留区分词', () => {
    const parsed = parseRecallClue('the article about memory', { nowMs: NOW_MS })
    const titles = [
      'Why AI Agents Need Long-Term Memory',
      'Building Agents with Durable Memory Stores'
    ]
    const mapped = mapLlmFollowUpProposal(
      {
        reply: 'Which title feels closer?',
        chips: [
          { label: 'Agents', value: 'agents' },
          { label: 'Durable', value: 'durable' }
        ]
      },
      { parsed, outcome: 'need_a_clue', weakCandidateTitles: titles }
    )
    expect(mapped?.suggestions.map(item => item.value)).toEqual(['durable'])
  })

  it('reply 含 snake_case 标识符整段拒收', () => {
    const parsed = parseRecallClue('the article about RAG', { nowMs: NOW_MS })
    expect(
      mapLlmFollowUpProposal(
        {
          reply: 'I found a need_a_clue outcome for you.',
          chips: [{ label: 'RAG', value: 'RAG' }]
        },
        { parsed, outcome: 'need_a_clue' }
      )
    ).toBeNull()
  })

  it('reply 含计数播报整段拒收', () => {
    const parsed = parseRecallClue('the article about RAG', { nowMs: NOW_MS })
    expect(
      mapLlmFollowUpProposal(
        {
          reply: 'Showing 12 results that might match.',
          chips: []
        },
        { parsed, outcome: 'need_a_clue' }
      )
    ).toBeNull()
    expect(
      mapLlmFollowUpProposal(
        {
          reply: '找到 3 条结果，看看哪条更像？',
          chips: []
        },
        { parsed, outcome: 'need_a_clue' }
      )
    ).toBeNull()
  })
})
