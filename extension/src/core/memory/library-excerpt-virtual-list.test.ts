import { describe, expect, it } from 'vitest'

import {
  buildExcerptLibraryRowMetrics,
  getExcerptLibraryRowStride
} from '@/core/memory/library-excerpt-virtual-list'
import { resolveBookmarkLibraryVisibleSlice } from '@/core/memory/bookmark-library-virtual-list'

describe('library-excerpt-virtual-list', () => {
  it('无附注与有附注 stride 不同', () => {
    expect(getExcerptLibraryRowStride(false)).toBeLessThan(getExcerptLibraryRowStride(true))
  })

  it('混合附注行可切片渲染窗口', () => {
    const flags = Array.from({ length: 40 }, (_, index) => index % 3 === 0)
    const metrics = buildExcerptLibraryRowMetrics(flags)
    const slice = resolveBookmarkLibraryVisibleSlice(metrics, flags.length, 200, 480, 4)
    expect(slice.end - slice.start).toBeLessThan(flags.length)
    expect(slice.end - slice.start).toBeGreaterThan(0)
  })
})
