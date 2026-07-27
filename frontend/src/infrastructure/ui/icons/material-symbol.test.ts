import { describe, expect, it } from 'vitest'

import {
  getMaterialSymbolPath,
  getMaterialSymbolViewBox,
  MATERIAL_SYMBOL_NAMES
} from './material-symbol'

describe('material-symbol', () => {
  it('每个登记名都有非空 path', () => {
    for (const name of MATERIAL_SYMBOL_NAMES) {
      expect(getMaterialSymbolPath(name).length).toBeGreaterThan(10)
    }
  })

  it('stacks 使用 960 网格 viewBox；其余默认 24', () => {
    expect(getMaterialSymbolViewBox('stacks')).toBe('0 -960 960 960')
    expect(getMaterialSymbolViewBox('settings')).toBe('0 0 24 24')
  })
})
