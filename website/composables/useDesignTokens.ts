/**
 * Nuxt composable for otterSage design tokens
 */

import { generateCSSVars } from '@ottersage/design-tokens/css-vars'

/**
 * 将 design tokens 注入到 CSS 变量中
 */
export function useDesignTokens() {
  if (process.client) {
    const vars = generateCSSVars()
    const root = document.documentElement

    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
  }
}
