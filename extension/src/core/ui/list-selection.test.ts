import { describe, expect, it } from 'vitest'

import {
  clampListSelectionIndex,
  listDeltaFromNavigateDirection,
  moveListSelectionIndex
} from '@/core/ui/list-selection'

describe('list-selection', () => {
  it('listDeltaFromNavigateDirection 仅映射上下', () => {
    expect(listDeltaFromNavigateDirection('down')).toBe(1)
    expect(listDeltaFromNavigateDirection('up')).toBe(-1)
    expect(listDeltaFromNavigateDirection('left')).toBeNull()
    expect(listDeltaFromNavigateDirection('right')).toBeNull()
  })

  it('moveListSelectionIndex 边界钳制并处理无选中', () => {
    expect(moveListSelectionIndex({ currentIndex: -1, itemCount: 3, delta: 1 })).toBe(0)
    expect(moveListSelectionIndex({ currentIndex: -1, itemCount: 3, delta: -1 })).toBe(2)
    expect(moveListSelectionIndex({ currentIndex: 0, itemCount: 3, delta: -1 })).toBe(0)
    expect(moveListSelectionIndex({ currentIndex: 2, itemCount: 3, delta: 1 })).toBe(2)
    expect(moveListSelectionIndex({ currentIndex: 1, itemCount: 3, delta: 1 })).toBe(2)
    expect(moveListSelectionIndex({ currentIndex: 1, itemCount: 3, delta: -1 })).toBe(0)
    expect(moveListSelectionIndex({ currentIndex: 0, itemCount: 0, delta: 1 })).toBe(-1)
  })

  it('clampListSelectionIndex', () => {
    expect(clampListSelectionIndex(5, 0)).toBe(-1)
    expect(clampListSelectionIndex(-2, 4)).toBe(0)
    expect(clampListSelectionIndex(9, 4)).toBe(3)
    expect(clampListSelectionIndex(2, 4)).toBe(2)
  })
})
