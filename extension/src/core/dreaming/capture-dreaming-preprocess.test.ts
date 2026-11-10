import { describe, expect, it } from 'vitest'

import {
  buildCaptureDreamingPreprocess,
  buildDreamingDuplicateGroupId
} from '@/core/dreaming/capture-dreaming-preprocess'
import { createTextExcerptMemoryItem } from '@/core/memory/create-memory-item'
import { serializeMemoryFoldKey, getMemoryFoldKey } from '@/core/memory/derive-memory-duplicate-key'

const OWNER = '11111111-1111-4111-8111-111111111111'
const PROFILE = '11111111-1111-4111-8111-111111111111'

describe('capture-dreaming-preprocess', () => {
  it('enrichment 前后折叠键一致（预处理不依赖 enrichment 产出）', () => {
    const item = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        selectedText: 'People organize information so they can find it later.',
        sourceUrl: 'https://example.com/a',
        pageTitle: 'Org',
        domain: 'example.com'
      },
      captureEntry: 'context_menu'
    })
    const link = buildCaptureDreamingPreprocess(item)
    expect(link.foldKey).toBe(serializeMemoryFoldKey(getMemoryFoldKey(item)))
    expect(link.id).toBe(buildDreamingDuplicateGroupId(OWNER, link.foldKey))
    expect(link.sourceMemoryItemId).toBe(item.id)
    expect(link.enrichmentReuseKey).toMatch(/^enrich:e:/)
  })

  it('同一选区两次 create 是两条新行（不同 id），折叠键相同', () => {
    const payload = {
      selectedText: 'same selection twice for dreaming fold',
      sourceUrl: 'https://example.com/dup',
      pageTitle: 'Dup',
      domain: 'example.com'
    } as const
    const a = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload,
      captureEntry: 'context_menu'
    })
    const b = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload,
      captureEntry: 'context_menu'
    })
    expect(a.id).not.toBe(b.id)
    expect(buildCaptureDreamingPreprocess(a).foldKey).toBe(
      buildCaptureDreamingPreprocess(b).foldKey
    )
  })
})
