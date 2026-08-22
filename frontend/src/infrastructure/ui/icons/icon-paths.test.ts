import { describe, expect, it } from 'vitest'

import {
  APP_ICON_LUCIDE_SOURCE,
  APP_ICON_NAMES,
  getAppIconNodes,
  getAppIconViewBox
} from './icon-paths'

describe('icon-paths', () => {
  it('每个登记名都有非空 Lucide 节点', () => {
    for (const name of APP_ICON_NAMES) {
      const nodes = getAppIconNodes(name)
      expect(nodes.length).toBeGreaterThan(0)
      expect(APP_ICON_LUCIDE_SOURCE[name].length).toBeGreaterThan(0)
      for (const [tag, attrs] of nodes) {
        expect(typeof tag).toBe('string')
        expect(tag.length).toBeGreaterThan(0)
        expect(attrs).toBeTypeOf('object')
      }
    }
  })

  it('统一 24×24 viewBox', () => {
    expect(getAppIconViewBox('stacks')).toBe('0 0 24 24')
    expect(getAppIconViewBox('settings')).toBe('0 0 24 24')
  })
})
