/**
 * CSS 变量生成器
 * 将设计令牌转换为 CSS 自定义属性
 */

import { colors } from './colors'
import { spacing, borderRadius, shadows, zIndex } from './spacing'
import { fontFamily, fontSize, fontWeight } from './typography'

/**
 * 生成 CSS 变量对象
 */
export function generateCSSVars() {
  return {
    // Material Design 主题色
    '--color-primary': colors.material.primary.css,
    '--color-primary-dark': colors.material.primaryDark.css,
    '--color-secondary': colors.material.secondary.css,
    '--color-secondary-dark': colors.material.secondaryDark.css,

    // 语义化颜色
    '--color-success': colors.semantic.success.css,
    '--color-warning': colors.semantic.warning.css,
    '--color-info': colors.semantic.info.css,
    '--color-error': colors.material.error.css,

    // 文本颜色（使用 Material Design 的 on-surface 颜色）
    '--color-text-primary': colors.material.onSurface.css,
    '--color-text-secondary': colors.material.onSurfaceDark.css,

    // 背景颜色
    '--color-bg-primary': colors.material.surface.css,
    '--color-bg-secondary': colors.material.surfaceDark.css,

    // 间距
    '--spacing-xs': spacing.xs,
    '--spacing-sm': spacing.sm,
    '--spacing-md': spacing.md,
    '--spacing-base': spacing.base,
    '--spacing-lg': spacing.lg,
    '--spacing-xl': spacing.xl,
    '--spacing-2xl': spacing['2xl'],
    '--spacing-3xl': spacing['3xl'],

    // 圆角
    '--radius-sm': borderRadius.sm,
    '--radius-md': borderRadius.md,
    '--radius-lg': borderRadius.lg,
    '--radius-xl': borderRadius.xl,
    '--radius-full': borderRadius.full,

    // 阴影
    '--shadow-sm': shadows.sm,
    '--shadow-md': shadows.md,
    '--shadow-lg': shadows.lg,
    '--shadow-focus': shadows.focus,

    // 字体
    '--font-sans': fontFamily.sans,
    '--font-mono': fontFamily.mono,

    // 字体大小
    '--text-xs': fontSize.xs,
    '--text-sm': fontSize.sm,
    '--text-base': fontSize.base,
    '--text-md': fontSize.md,
    '--text-lg': fontSize.lg,
    '--text-xl': fontSize.xl,
    '--text-2xl': fontSize['2xl'],
    '--text-3xl': fontSize['3xl'],

    // 字重
    '--font-normal': fontWeight.normal,
    '--font-medium': fontWeight.medium,
    '--font-semibold': fontWeight.semibold,
    '--font-bold': fontWeight.bold,

    // Z-index
    '--z-dropdown': String(zIndex.dropdown),
    '--z-modal': String(zIndex.modal),
    '--z-toast': String(zIndex.toast)
  }
}

/**
 * 生成 CSS 字符串
 */
export function generateCSSString(): string {
  const vars = generateCSSVars()
  const cssVars = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')

  return `:root {\n${cssVars}\n}`
}

/**
 * 为插件前端生成 Chrome Material Design CSS 变量
 * 
 * ⚠️ 注意：Material Design 颜色已经在 material-theme.css 中定义
 * 这里只保留语义化颜色的映射
 */
export function generateMaterialCSSVars() {
  return {
    // Material Design 主题色
    '--acuity-brand-primary': colors.material.primary.css,
    '--acuity-brand-secondary': colors.material.secondary.css,
    
    // 语义化颜色
    '--acuity-semantic-success': colors.semantic.success.css,
    '--acuity-semantic-warning': colors.semantic.warning.css,
    '--acuity-semantic-info': colors.semantic.info.css,
    
    // 强调色
    '--acuity-accent-gold': colors.accent.gold.css,
    '--acuity-accent-teal': colors.accent.teal.css,
    '--acuity-accent-amber': colors.accent.amber.css,
    '--acuity-accent-purple': colors.accent.purple.css
  }
}

/**
 * 生成 Material Design CSS 字符串
 */
export function generateMaterialCSSString(): string {
  const vars = generateMaterialCSSVars()
  const cssVars = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')

  return `:root {\n${cssVars}\n}`
}

export type CSSVars = ReturnType<typeof generateCSSVars>
export type MaterialCSSVars = ReturnType<typeof generateMaterialCSSVars>
