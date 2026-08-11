import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import {
  assessCorpusAnchorQuality,
  isShellBookmarkTitle,
  RECALL_WEAK_ANCHOR_PENALTY,
  weakAnchorScorePenalty
} from '@/core/memory/corpus-quality-gate'
import { scoreMemoryItem } from '@/core/recall/keyword-filter'

const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sourceLocalProfileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('corpus-quality-gate', () => {
  it('识别 URL/域名回显为空壳标题', () => {
    expect(
      isShellBookmarkTitle('https://example.com/path', 'https://example.com/path', 'example.com')
    ).toBe(true)
    expect(isShellBookmarkTitle('example.com', 'https://example.com/x', 'example.com')).toBe(true)
    expect(
      isShellBookmarkTitle(
        'Retention analysis framework',
        'https://growth.example.com/x',
        'growth.example.com'
      )
    ).toBe(false)
  })

  it('摘录非空即 accept（弱锚点主打空壳书签）', () => {
    const rich = createTextExcerptMemoryItem({
      ownerId,
      sourceLocalProfileId,
      payload: {
        selectedText: 'This is a long enough excerpt body for recall.',
        sourceUrl: 'https://example.com/a',
        pageTitle: 'Page',
        domain: 'example.com'
      }
    })
    expect(assessCorpusAnchorQuality(rich)).toEqual({
      decision: 'accept',
      reason: 'excerpt_body'
    })

    const short = createTextExcerptMemoryItem({
      ownerId,
      sourceLocalProfileId,
      payload: {
        selectedText: 'Short',
        sourceUrl: 'https://example.com/b',
        pageTitle: 'Page',
        domain: 'example.com'
      }
    })
    expect(assessCorpusAnchorQuality(short).decision).toBe('accept')
  })

  it('书签有备注 → accept；空壳标题无备注 → weak', () => {
    const noted = createBookmarkMemoryItem({
      ownerId,
      sourceLocalProfileId,
      payload: {
        title: 'https://shell.example.com/',
        url: 'https://shell.example.com/',
        domain: 'shell.example.com'
      },
      clues: { note: 'the page for the leadership review' }
    })
    expect(assessCorpusAnchorQuality(noted).decision).toBe('accept')

    const shell = createBookmarkMemoryItem({
      ownerId,
      sourceLocalProfileId,
      payload: {
        title: 'https://shell.example.com/',
        url: 'https://shell.example.com/',
        domain: 'shell.example.com'
      }
    })
    expect(assessCorpusAnchorQuality(shell)).toEqual({
      decision: 'weak',
      reason: 'bookmark_shell_title'
    })
    expect(weakAnchorScorePenalty(shell)).toBe(RECALL_WEAK_ANCHOR_PENALTY)
  })

  it('召回打分：空壳书签弱于同域有标题书签', () => {
    const titled = createBookmarkMemoryItem({
      ownerId,
      sourceLocalProfileId,
      payload: {
        title: 'Shell Example Docs',
        url: 'https://shell.example.com/docs',
        domain: 'shell.example.com'
      }
    })
    const shell = createBookmarkMemoryItem({
      ownerId,
      sourceLocalProfileId,
      payload: {
        title: 'https://shell.example.com/',
        url: 'https://shell.example.com/',
        domain: 'shell.example.com'
      }
    })

    const clue = 'shell.example.com'
    const titledScore = scoreMemoryItem(titled, clue).score
    const shellScore = scoreMemoryItem(shell, clue).score
    expect(titledScore).toBeGreaterThan(shellScore)
    expect(assessCorpusAnchorQuality(shell).decision).toBe('weak')
  })
})
