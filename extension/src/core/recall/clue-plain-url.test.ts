import { describe, expect, it } from 'vitest'

import {
  formatCluePlainForUserDisplay,
  formatSavedTitleForUserDisplay,
  normalizeClueUrl,
  parseCluePlainSegments,
  serializeClueSegmentsToPlain
} from '@/core/recall/clue-plain-url'
import { formatClueUrlDisplayLabel } from '@/core/recall/clue-url-display'

describe('normalizeClueUrl', () => {
  it('接受 https 并规范化', () => {
    expect(normalizeClueUrl('https://Example.com/Path')).toBe('https://example.com/Path')
  })

  it('www 补 https', () => {
    expect(normalizeClueUrl('www.example.com/a')).toBe('https://www.example.com/a')
  })

  it('拒绝 javascript / 非法 scheme', () => {
    expect(normalizeClueUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeClueUrl('data:text/html,hi')).toBeNull()
  })

  it('剥尾部句读', () => {
    expect(normalizeClueUrl('https://example.com/x.')).toBe('https://example.com/x')
  })
})

describe('parseCluePlainSegments', () => {
  it('混排：口语 + URL + 空白边界收芯片', () => {
    const segments = parseCluePlainSegments('that page https://example.com/docs ok', {
      chipTrailing: false
    })
    expect(segments).toEqual([
      { kind: 'text', text: 'that page ' },
      { kind: 'url', href: 'https://example.com/docs', raw: 'https://example.com/docs' },
      { kind: 'text', text: ' ok' }
    ])
  })

  it('文末 URL 默认不收；chipTrailing 才收', () => {
    const live = parseCluePlainSegments('see https://example.com/x', { chipTrailing: false })
    expect(live.every(s => s.kind === 'text')).toBe(true)

    const blur = parseCluePlainSegments('see https://example.com/x', { chipTrailing: true })
    expect(blur.some(s => s.kind === 'url')).toBe(true)
  })

  it('往返序列化保留规范化 href', () => {
    const plain = 'read www.example.com/a please'
    const segments = parseCluePlainSegments(plain, { chipTrailing: true })
    expect(serializeClueSegmentsToPlain(segments)).toContain('https://www.example.com/a')
  })

  it('URL 后粘中文：URL 收芯片，中文留 text', () => {
    const segments = parseCluePlainSegments('https://example.com/x跟', {
      chipTrailing: false
    })
    expect(segments).toEqual([
      { kind: 'url', href: 'https://example.com/x', raw: 'https://example.com/x' },
      { kind: 'text', text: '跟' }
    ])
  })

  it('长 query URL 后粘中文同样切开', () => {
    const base = 'https://supabase.com/dashboard/project/abc/editor/93011?schema=public'
    const segments = parseCluePlainSegments(`${base}跟`, { chipTrailing: true })
    expect(segments).toEqual([
      { kind: 'url', href: base, raw: base },
      { kind: 'text', text: '跟' }
    ])
  })
})

describe('formatCluePlainForUserDisplay', () => {
  it('口语夹 URL：只缩短 URL，周围字不动；非传输改写', () => {
    const raw = '跟https://yiveno.com/terms/这个相关的'
    const display = formatCluePlainForUserDisplay(raw)
    expect(display).toBe('跟yiveno.com/terms/这个相关的')
    expect(display).not.toContain('https://')
    expect(raw).toContain('https://yiveno.com/terms/')
  })

  it('无 URL 原样返回', () => {
    expect(formatCluePlainForUserDisplay('that JS article')).toBe('that JS article')
  })

  it('与 formatClueUrlDisplayLabel 一致', () => {
    const href = 'https://www.example.com/very/long/path/here'
    expect(formatCluePlainForUserDisplay(href)).toBe(formatClueUrlDisplayLabel(href))
  })
})

describe('formatSavedTitleForUserDisplay', () => {
  it('人读标题原样；纯 URL 标题缩短；空标题回退 url', () => {
    expect(formatSavedTitleForUserDisplay('Retention notes', 'https://example.com/x')).toBe(
      'Retention notes'
    )
    expect(formatSavedTitleForUserDisplay('https://www.example.com/docs/a')).toBe(
      formatClueUrlDisplayLabel('https://www.example.com/docs/a')
    )
    expect(formatSavedTitleForUserDisplay('', 'https://example.com/')).toBe('example.com')
  })
})
