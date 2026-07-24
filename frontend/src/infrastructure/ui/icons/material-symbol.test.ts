import { describe, expect, it } from 'vitest'

import { getMaterialSymbolPath, MATERIAL_SYMBOL_NAMES } from './material-symbol'

describe('material-symbol', () => {
  it('每个登记名都有非空 path', () => {
    for (const name of MATERIAL_SYMBOL_NAMES) {
      expect(getMaterialSymbolPath(name).length).toBeGreaterThan(10)
    }
  })
})
