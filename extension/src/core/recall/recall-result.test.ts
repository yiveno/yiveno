import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import { testTranslateEn } from '@/core/i18n/test-translate-en'
import {
  formatExcerptProvenance,
  formatMatchedFields,
  getMemoryItemDisplay
} from '@/core/recall/recall-result'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-24T10:00:00.000Z'
}

describe('formatMatchedFields', () => {
  it('无线索时退化为字段名列表', () => {
    expect(formatMatchedFields(['title', 'domain'], testTranslateEn)).toBe(
      'Found in: title, domain'
    )
    expect(formatMatchedFields([], testTranslateEn)).toBe('Related to your clue')
  })

  it('有线索时委托 explainRecallMatch', () => {
    expect(formatMatchedFields(['title'], testTranslateEn, 'retention')).toContain('Found')
  })
})

describe('getMemoryItemDisplay', () => {
  it('书签以书签名为主标题', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Retention analysis', url: 'https://example.com/retention' }
    })
    expect(getMemoryItemDisplay(item, testTranslateEn)).toMatchObject({
      title: 'Retention analysis',
      subtitle: 'example.com',
      typeLabel: 'Bookmark'
    })
  })

  it('书签标题若为 URL：可见面缩短，契约 url 仍完整', () => {
    const href = 'https://www.example.com/very/long/path/docs'
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: href, url: href }
    })
    const display = getMemoryItemDisplay(item, testTranslateEn)
    expect(display.title).not.toContain('https://')
    expect(display.title.startsWith('example.com')).toBe(true)
    expect(display.url).toBe(href)
  })

  it('摘录无标题，正文为主，页名为出处', () => {
    const item = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'Key retention metrics overview',
        sourceUrl: 'https://notes.example.com/post',
        pageTitle: 'Growth notes'
      }
    })
    expect(getMemoryItemDisplay(item, testTranslateEn)).toEqual({
      title: '',
      subtitle: 'Growth notes · notes.example.com',
      url: 'https://notes.example.com/post',
      excerpt: 'Key retention metrics overview',
      typeLabel: 'Excerpt'
    })
  })
})

describe('formatExcerptProvenance', () => {
  it('拼页名与域名', () => {
    expect(formatExcerptProvenance('Growth notes', 'notes.example.com')).toBe(
      'Growth notes · notes.example.com'
    )
  })

  it('缺页名时仅域名', () => {
    expect(formatExcerptProvenance('', 'notes.example.com')).toBe('notes.example.com')
  })
})
