import { describe, expect, it } from 'vitest'

import { flattenChromeBookmarkTree } from '@/infrastructure/browser/chrome-bookmark-reader'

describe('chrome-bookmark-reader', () => {
  it('flattenChromeBookmarkTree 只保留 http(s) 叶子书签', () => {
    const leaves = flattenChromeBookmarkTree([
      {
        id: '0',
        syncing: false,
        title: '',
        children: [
          {
            id: '1',
            syncing: false,
            title: '书签栏',
            children: [
              {
                id: '10',
                syncing: false,
                title: 'Example',
                url: 'https://example.com',
                parentId: '1',
                dateAdded: Date.parse('2026-01-01T00:00:00.000Z')
              },
              {
                id: '11',
                syncing: false,
                title: '扩展页',
                url: 'chrome://extensions',
                parentId: '1'
              },
              {
                id: '12',
                syncing: false,
                title: '文件夹',
                children: [
                  {
                    id: '120',
                    syncing: false,
                    title: 'Nested',
                    url: 'http://nested.example.com',
                    parentId: '12'
                  }
                ]
              }
            ]
          }
        ]
      }
    ])

    expect(leaves).toHaveLength(2)
    expect(leaves[0]).toMatchObject({
      chromeBookmarkId: '10',
      title: 'Example',
      url: 'https://example.com'
    })
    expect(leaves[1]?.chromeBookmarkId).toBe('120')
  })

  it('空标题时回退为 URL', () => {
    const leaves = flattenChromeBookmarkTree([
      {
        id: '1',
        syncing: false,
        title: '',
        url: 'https://untitled.example.com'
      }
    ])

    expect(leaves[0]?.title).toBe('https://untitled.example.com')
  })
})
