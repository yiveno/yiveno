/**
 * RecallResultCard：类型角标可见微文字（主卡 + sibling）。
 * 用 createApp 挂载（仓内尚无 @vue/test-utils）。
 */
import { createApp, nextTick, type App } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'
import RecallResultCard from '@/pages/sidepanel/RecallResultCard.vue'

function emptyParts(): RecallCardModel['titleParts'] {
  return []
}

function baseCard(
  partial: Partial<RecallCardModel> & Pick<RecallCardModel, 'id' | 'itemKind' | 'typeLabel'>
): RecallCardModel {
  return {
    title: 'Sample title',
    subtitle: 'example.com',
    url: 'https://example.com/page',
    titleParts: emptyParts(),
    subtitleParts: emptyParts(),
    excerptParts: emptyParts(),
    noteParts: emptyParts(),
    ...partial
  }
}

type MountResult = { app: App; root: HTMLElement }

function mountCard(card: RecallCardModel, extra?: { expanded?: boolean }): MountResult {
  const root = document.createElement('div')
  document.body.appendChild(root)
  const app = createApp(RecallResultCard, {
    card,
    resultDomId: `result-${card.id}`,
    keyboardSelected: false,
    topPick: false,
    compact: false,
    expanded: extra?.expanded ?? false,
    expandLabel: 'Show more',
    collapseLabel: 'Show less',
    noteFieldLabel: 'Note'
  })
  app.mount(root)
  return { app, root }
}

describe('RecallResultCard 类型角标微文字', () => {
  const mounts: MountResult[] = []

  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test${path}`
      },
      i18n: {
        getUILanguage: () => 'en',
        getMessage: (key: string) => key
      }
    })
  })

  afterEach(() => {
    for (const m of mounts.splice(0)) {
      m.app.unmount()
      m.root.remove()
    }
    vi.unstubAllGlobals()
  })

  it('主卡：书签与摘录各自渲染可见 typeLabel', async () => {
    const bookmark = mountCard(
      baseCard({ id: 'bm-1', itemKind: 'bookmark', typeLabel: 'Bookmark' })
    )
    mounts.push(bookmark)
    const excerpt = mountCard(
      baseCard({
        id: 'ex-1',
        itemKind: 'text_excerpt',
        typeLabel: 'Text excerpt',
        excerpt: 'Some saved text'
      })
    )
    mounts.push(excerpt)
    await nextTick()

    const bookmarkLabels = bookmark.root.querySelectorAll('.recall-type-chip__label')
    expect(bookmarkLabels).toHaveLength(1)
    expect(bookmarkLabels[0]?.textContent).toBe('Bookmark')

    const excerptLabels = excerpt.root.querySelectorAll('.recall-type-chip__label')
    expect(excerptLabels).toHaveLength(1)
    expect(excerptLabels[0]?.textContent).toBe('Text excerpt')
  })

  it('sibling 卡：书签与摘录各自渲染可见 typeLabel', async () => {
    const mounted = mountCard(
      baseCard({
        id: 'group-1',
        itemKind: 'bookmark',
        typeLabel: 'Bookmark',
        duplicateTotalCount: 3,
        duplicateLabel: '3 items',
        siblings: [
          baseCard({
            id: 'sib-bm',
            itemKind: 'bookmark',
            typeLabel: 'Bookmark',
            title: 'Sibling bookmark'
          }),
          baseCard({
            id: 'sib-ex',
            itemKind: 'text_excerpt',
            typeLabel: 'Text excerpt',
            title: 'Sibling excerpt',
            excerpt: 'Sibling body'
          })
        ]
      }),
      { expanded: true }
    )
    mounts.push(mounted)
    await nextTick()

    const siblingChips = mounted.root.querySelectorAll(
      '.recall-sibling-item > .recall-type-chip--corner .recall-type-chip__label'
    )
    expect(siblingChips).toHaveLength(2)
    expect([...siblingChips].map(el => el.textContent)).toEqual(['Bookmark', 'Text excerpt'])
  })
})
