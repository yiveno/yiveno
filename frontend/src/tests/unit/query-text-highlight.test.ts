import { describe, expect, it } from 'vitest'
import {
  highlightQueryTextAsHtml,
  highlightQueryTextAsSegments
} from '@/core/filter/query-text-highlight'

describe('highlightQueryTextAsHtml', () => {
  it('空 query 时转义 HTML 但不加 mark', () => {
    expect(highlightQueryTextAsHtml('Vue &amp; Docs', '')).toBe('Vue &amp;amp; Docs')
  })

  it('多词 query 高亮各匹配片段', () => {
    const html = highlightQueryTextAsHtml('GitHub Vue Documentation', 'github vue')
    expect(html).toContain('<mark>GitHub</mark>')
    expect(html).toContain('<mark>Vue</mark>')
  })

  it('中文子串高亮', () => {
    const html = highlightQueryTextAsHtml('前端开发指南', '前端')
    expect(html).toBe('<mark>前端</mark>开发指南')
  })

  it('segments 模式返回高亮标记', () => {
    const segments = highlightQueryTextAsSegments('网易云音乐', '音乐')
    expect(segments).toEqual([
      { text: '网易云', highlighted: false },
      { text: '音乐', highlighted: true }
    ])
  })
})
