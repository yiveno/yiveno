/**
 * AcuityBookmarks 字体系统
 */

/**
 * 字体家族
 */
export const fontFamily = {
  /** 无衬线字体 - 用于正文和界面 */
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  /** 等宽字体 - 用于代码 */
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  /** 衬线字体 - 用于标题（可选） */
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif'
} as const

/**
 * 字体大小
 */
export const fontSize = {
  /** 10px */
  xs: '0.625rem',
  /** 12px */
  sm: '0.75rem',
  /** 14px */
  base: '0.875rem',
  /** 16px */
  md: '1rem',
  /** 18px */
  lg: '1.125rem',
  /** 20px */
  xl: '1.25rem',
  /** 24px */
  '2xl': '1.5rem',
  /** 30px */
  '3xl': '1.875rem',
  /** 36px */
  '4xl': '2.25rem',
  /** 48px */
  '5xl': '3rem'
} as const

/**
 * 字重
 */
export const fontWeight = {
  /** 300 */
  light: '300',
  /** 400 */
  normal: '400',
  /** 500 */
  medium: '500',
  /** 600 */
  semibold: '600',
  /** 700 */
  bold: '700',
  /** 800 */
  extrabold: '800'
} as const

/**
 * 行高
 */
export const lineHeight = {
  /** 紧凑 */
  tight: '1.25',
  /** 紧密 */
  snug: '1.375',
  /** 正常 */
  normal: '1.5',
  /** 宽松 */
  relaxed: '1.625',
  /** 超宽松 */
  loose: '2'
} as const

/**
 * 字母间距
 */
export const letterSpacing = {
  /** 紧凑 */
  tighter: '-0.05em',
  /** 紧密 */
  tight: '-0.025em',
  /** 正常 */
  normal: '0',
  /** 宽松 */
  wide: '0.025em',
  /** 超宽松 */
  wider: '0.05em',
  /** 最宽松 */
  widest: '0.1em'
} as const

export type FontFamily = typeof fontFamily
export type FontSize = typeof fontSize
export type FontWeight = typeof fontWeight
export type LineHeight = typeof lineHeight
export type LetterSpacing = typeof letterSpacing
