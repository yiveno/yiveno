import { describe, expect, test } from 'bun:test'

import { parseGsClueSamplesText, type GsClueSamplesBookmark } from './gs-clue-samples-proposal'

const BOOKMARK: GsClueSamplesBookmark = {
  title: 'Why AI Agents Need Long-Term Memory',
  url: 'https://example.com/agents-memory'
}

const FOUR_OK = {
  clues: [
    { text: 'That piece about why agents struggle to keep track of earlier turns in a chat' },
    { text: 'I remember reading something explaining why long-term memory for AI agents is hard' },
    { text: 'Something from work about giving assistants memory that lasts beyond one session' },
    { text: 'The surprising bit about agents forgetting context even when you feed them history' }
  ]
}

describe('parseGsClueSamplesText 校验', () => {
  test('正常 4 条通过', () => {
    const parsed = parseGsClueSamplesText(JSON.stringify(FOUR_OK), BOOKMARK)
    expect(parsed?.clues).toHaveLength(4)
  })

  test('归一化后重复 → null', () => {
    const dup = {
      clues: [
        FOUR_OK.clues[0],
        FOUR_OK.clues[1],
        FOUR_OK.clues[2],
        {
          text: '  That   piece about why agents struggle to keep track of earlier turns in a chat  '
        }
      ]
    }
    expect(parseGsClueSamplesText(JSON.stringify(dup), BOOKMARK)).toBeNull()
  })

  test('含 CJK → null', () => {
    const withCjk = {
      clues: [
        FOUR_OK.clues[0],
        FOUR_OK.clues[1],
        FOUR_OK.clues[2],
        { text: '那篇讲 agent 长期记忆为什么难的文章我存过' }
      ]
    }
    expect(parseGsClueSamplesText(JSON.stringify(withCjk), BOOKMARK)).toBeNull()
  })

  test('词数不在 6–40 → null', () => {
    const short = {
      clues: [FOUR_OK.clues[0], FOUR_OK.clues[1], FOUR_OK.clues[2], { text: 'agents memory hard' }]
    }
    expect(parseGsClueSamplesText(JSON.stringify(short), BOOKMARK)).toBeNull()
  })

  test('含完整 title → null', () => {
    const withTitle = {
      clues: [
        FOUR_OK.clues[0],
        FOUR_OK.clues[1],
        FOUR_OK.clues[2],
        {
          text: 'I saved Why AI Agents Need Long-Term Memory after reading about recall hooks'
        }
      ]
    }
    expect(parseGsClueSamplesText(JSON.stringify(withTitle), BOOKMARK)).toBeNull()
  })

  test('含 url 原文 → null', () => {
    const withUrl = {
      clues: [
        FOUR_OK.clues[0],
        FOUR_OK.clues[1],
        FOUR_OK.clues[2],
        {
          text: 'That page at https://example.com/agents-memory about keeping agent context around'
        }
      ]
    }
    expect(parseGsClueSamplesText(JSON.stringify(withUrl), BOOKMARK)).toBeNull()
  })
})
