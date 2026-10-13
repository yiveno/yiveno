import { describe, expect, it } from 'vitest'

import { resolveRecallCardClickAction } from '@/pages/sidepanel/recall-result-card-interaction'

describe('resolveRecallCardClickAction', () => {
  const base = {
    memoryItemId: 'mem-1',
    url: 'https://example.com',
    rank: 2,
    metaKey: false,
    ctrlKey: false,
    detailExportDisabled: false
  }

  it('detail export 模式：切换选中', () => {
    expect(
      resolveRecallCardClickAction({
        ...base,
        showDetailExportSelection: true
      })
    ).toEqual({ type: 'toggle-export', memoryItemId: 'mem-1' })
  })

  it('detail export 模式且 disabled：noop', () => {
    expect(
      resolveRecallCardClickAction({
        ...base,
        showDetailExportSelection: true,
        detailExportDisabled: true
      })
    ).toEqual({ type: 'noop' })
  })

  it('默认模式：当前标签打开', () => {
    expect(resolveRecallCardClickAction(base)).toEqual({
      type: 'open',
      payload: { id: 'mem-1', url: 'https://example.com', openInNewTab: false, rank: 2 }
    })
  })

  it('⌘/Ctrl 点击：新开标签', () => {
    expect(
      resolveRecallCardClickAction({
        ...base,
        metaKey: true
      })
    ).toEqual({
      type: 'open',
      payload: { id: 'mem-1', url: 'https://example.com', openInNewTab: true, rank: 2 }
    })

    expect(
      resolveRecallCardClickAction({
        ...base,
        ctrlKey: true
      })
    ).toEqual({
      type: 'open',
      payload: { id: 'mem-1', url: 'https://example.com', openInNewTab: true, rank: 2 }
    })
  })
})
