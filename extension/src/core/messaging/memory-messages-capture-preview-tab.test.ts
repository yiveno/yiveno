import { describe, expect, it } from 'vitest'

import {
  parseCaptureBookmarkPayload,
  parseCaptureTextExcerptPayload
} from '@/core/messaging/memory-messages'

describe('CAPTURE payload tabId/windowId', () => {
  it('parseCaptureTextExcerptPayload 接受 tabId + windowId', () => {
    expect(
      parseCaptureTextExcerptPayload({
        selectedText: 'hello excerpt',
        sourceUrl: 'https://example.com/p',
        pageTitle: 'Post',
        tabId: 9,
        windowId: 3
      })
    ).toMatchObject({
      selectedText: 'hello excerpt',
      sourceUrl: 'https://example.com/p',
      pageTitle: 'Post',
      tabId: 9,
      windowId: 3
    })
  })

  it('parseCaptureTextExcerptPayload 可省略 tab 上下文', () => {
    expect(
      parseCaptureTextExcerptPayload({
        selectedText: 'hello excerpt',
        sourceUrl: 'https://example.com/p',
        pageTitle: 'Post'
      })
    ).toMatchObject({
      selectedText: 'hello excerpt',
      sourceUrl: 'https://example.com/p',
      pageTitle: 'Post'
    })
  })

  it('parseCaptureBookmarkPayload 接受 windowId', () => {
    expect(
      parseCaptureBookmarkPayload({
        title: 'Docs',
        url: 'https://example.com/docs',
        windowId: 0
      })
    ).toMatchObject({
      title: 'Docs',
      url: 'https://example.com/docs',
      windowId: 0
    })
  })

  it('拒绝非法 tabId', () => {
    expect(() =>
      parseCaptureTextExcerptPayload({
        selectedText: 'x',
        sourceUrl: 'https://example.com/p',
        pageTitle: 'P',
        tabId: -1
      })
    ).toThrow()
  })
})
