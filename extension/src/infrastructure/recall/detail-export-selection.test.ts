import { describe, expect, it } from 'vitest'

import {
  invertDetailExportSelection,
  selectAllDetailExportItems,
  toggleDetailExportSelection
} from '@/infrastructure/recall/detail-export-selection'

describe('detail-export-selection', () => {
  it('toggleDetailExportSelection 无条数上限', () => {
    let selected = new Set<string>()
    for (let i = 0; i < 8; i += 1) {
      const id = `00000000-0000-4000-8000-00000000000${i}`
      selected = toggleDetailExportSelection(selected, id)
    }
    expect(selected.size).toBe(8)
  })

  it('selectAllDetailExportItems 全选', () => {
    const selected = selectAllDetailExportItems(['z', 'y', 'x'])
    expect([...selected]).toEqual(['z', 'y', 'x'])
  })

  it('invertDetailExportSelection 翻转', () => {
    const exportable = ['a', 'b', 'c', 'd']
    const inverted = invertDetailExportSelection(exportable, new Set(['a', 'b']))
    expect([...inverted]).toEqual(['c', 'd'])
  })
})
