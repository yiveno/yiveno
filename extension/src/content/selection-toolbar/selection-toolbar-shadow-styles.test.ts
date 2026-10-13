import { describe, expect, it } from 'vitest'

import {
  getSelectionToolbarShadowStyles,
  scopeDesignTokensToShadowHost,
  SELECTION_TOOLBAR_COMPONENT_CSS
} from '@/content/selection-toolbar/selection-toolbar-shadow-styles'

describe('selection-toolbar-shadow-styles', () => {
  it('组件样式不含硬编码 hex（走 design token var）', () => {
    expect(SELECTION_TOOLBAR_COMPONENT_CSS).not.toMatch(/#[0-9a-f]{3,8}/i)
    expect(SELECTION_TOOLBAR_COMPONENT_CSS).not.toMatch(/rgb\(/i)
  })

  it('组件样式引用品牌 role token', () => {
    expect(SELECTION_TOOLBAR_COMPONENT_CSS).toContain('var(--accent)')
    expect(SELECTION_TOOLBAR_COMPONENT_CSS).toContain('var(--surface-accent-soft)')
    expect(SELECTION_TOOLBAR_COMPONENT_CSS).toContain('var(--shadow-ink-sm)')
  })

  it('scopeDesignTokensToShadowHost 将 :root 换成 :host', () => {
    const scoped = scopeDesignTokensToShadowHost(':root { --accent: red; }')
    expect(scoped).toContain(':host {')
    expect(scoped).not.toContain(':root {')
  })

  it('getSelectionToolbarShadowStyles 拼接 token 与组件规则', () => {
    const styles = getSelectionToolbarShadowStyles()
    expect(styles).toContain('.toolbar {')
    expect(styles).toContain('var(--accent)')
  })
})
