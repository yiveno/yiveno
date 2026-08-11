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
})
