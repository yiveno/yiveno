import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import {
  buildEvidencePack,
  parseEvidencePack,
  renderEvidencePackMarkdown,
  validateEvidencePackSelectionCount
} from '@/core/recall/evidence-pack'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-08-27T12:00:00.000Z'
}

describe('evidence-pack', () => {
  it('validateEvidencePackSelectionCount 仅允许 2–5', () => {
    expect(validateEvidencePackSelectionCount(1)).toBe(false)
    expect(validateEvidencePackSelectionCount(2)).toBe(true)
    expect(validateEvidencePackSelectionCount(5)).toBe(true)
    expect(validateEvidencePackSelectionCount(6)).toBe(false)
  })

  it('buildEvidencePack 含摘录与书签字段', () => {
    const excerpt = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'Release checklist before deploy.',
        sourceUrl: 'https://example.com/post',
        pageTitle: 'Deploy notes',
        domain: 'example.com'
      },
      clues: { note: 'Important' }
    })
    const bookmark = createBookmarkMemoryItem({
      ...baseContext,
      payload: {
        title: 'Runbook',
        url: 'https://example.com/runbook',
        domain: 'example.com'
      }
    })

    const pack = buildEvidencePack([excerpt, bookmark], '2026-08-27T12:00:00.000Z')
    expect(pack.version).toBe(1)
    expect(pack.items).toHaveLength(2)
    expect(pack.items[0]?.type).toBe('text_excerpt')
    expect(pack.items[0]?.note).toBe('Important')
    expect(pack.items[1]?.type).toBe('bookmark')
    expect(() => parseEvidencePack(pack)).not.toThrow()
  })

  it('renderEvidencePackMarkdown 与 JSON 条目一致', () => {
    const excerpt = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'Anchor text.',
        sourceUrl: 'https://example.com/a',
        pageTitle: 'Page A',
        domain: 'example.com'
      }
    })
    const pack = buildEvidencePack([excerpt, excerpt], '2026-08-27T12:00:00.000Z')
    const md = renderEvidencePackMarkdown(pack)
    expect(md).toContain('# Yiveno Evidence Pack')
    expect(md).toContain('Text excerpt')
    expect(md).toContain('Anchor text.')
    expect(md).toContain('not a full library export')
  })
})
