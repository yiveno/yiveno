import { describe, expect, it } from 'vitest'

import { resolveBookmarkActivateAction } from '@/pages/library/bookmark-library-activate'

describe('resolveBookmarkActivateAction', () => {
  it('导出+有 memoryItemId → toggle', () => {
    expect(
      resolveBookmarkActivateAction({
        isKeyboard: false,
        hasMemoryItemId: true,
        exportMode: true
      })
    ).toBe('toggle')
  })

  it('导出+无 memoryItemId → ignore', () => {
    expect(
      resolveBookmarkActivateAction({
        isKeyboard: false,
        hasMemoryItemId: false,
        exportMode: true
      })
    ).toBe('ignore')
  })

  it('导出+键盘+无 → ignore', () => {
    expect(
      resolveBookmarkActivateAction({
        isKeyboard: true,
        hasMemoryItemId: false,
        exportMode: true
      })
    ).toBe('ignore')
  })

  it('导出+键盘+有 → toggle', () => {
    expect(
      resolveBookmarkActivateAction({
        isKeyboard: true,
        hasMemoryItemId: true,
        exportMode: true
      })
    ).toBe('toggle')
  })

  it('非导出+键盘 → open', () => {
    expect(
      resolveBookmarkActivateAction({
        isKeyboard: true,
        hasMemoryItemId: true,
        exportMode: false
      })
    ).toBe('open')
  })

  it('非导出+鼠标 → open', () => {
    expect(
      resolveBookmarkActivateAction({
        isKeyboard: false,
        hasMemoryItemId: true,
        exportMode: false
      })
    ).toBe('open')
  })

  it('非导出+鼠标+无 memoryItemId → open', () => {
    expect(
      resolveBookmarkActivateAction({
        isKeyboard: false,
        hasMemoryItemId: false,
        exportMode: false
      })
    ).toBe('open')
  })

  it('非导出+键盘+无 memoryItemId → open', () => {
    expect(
      resolveBookmarkActivateAction({
        isKeyboard: true,
        hasMemoryItemId: false,
        exportMode: false
      })
    ).toBe('open')
  })
})
