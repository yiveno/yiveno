/**
 * AcuityBookmarks 颜色系统
 * 
 * 核心设计理念：基于 Material Design 3
 * - 完全遵循 Material Design 3 规范
 * - 提供多种格式的颜色值（CSS 变量、RGB、Hex）
 * - 支持在无法使用 CSS 变量的场景（Canvas、Badge API、Console 等）
 */

/**
 * 颜色值类型
 * 提供多种格式以适应不同使用场景
 */
export interface ColorValue {
  /** CSS 变量引用（推荐用于 Vue/React 组件） */
  css: string
  /** RGB 格式（用于 Canvas、Badge API 等） */
  rgb: string
  /** Hex 格式（用于某些第三方库） */
  hex: string
}

/**
 * Material Design 3 主题色
 * 
 * 这些颜色来自 material-theme.css，基于种子色 #3B82F6 生成
 */
export const materialColors = {
  /** 主色（亮色主题） */
  primary: {
    css: 'var(--md-sys-color-primary)',
    rgb: 'rgb(47, 98, 140)',
    hex: '#2f628c'
  } as ColorValue,

  /** 主色（暗色主题） */
  primaryDark: {
    css: 'var(--md-sys-color-primary)',
    rgb: 'rgb(155, 203, 251)',
    hex: '#9bcbfb'
  } as ColorValue,

  /** 主色容器（亮色主题） */
  primaryContainer: {
    css: 'var(--md-sys-color-primary-container)',
    rgb: 'rgb(206, 229, 255)',
    hex: '#cee5ff'
  } as ColorValue,

  /** 次要色（亮色主题） */
  secondary: {
    css: 'var(--md-sys-color-secondary)',
    rgb: 'rgb(81, 96, 111)',
    hex: '#51606f'
  } as ColorValue,

  /** 次要色（暗色主题） */
  secondaryDark: {
    css: 'var(--md-sys-color-secondary)',
    rgb: 'rgb(185, 200, 218)',
    hex: '#b9c8da'
  } as ColorValue,

  /** 错误色（亮色主题） */
  error: {
    css: 'var(--md-sys-color-error)',
    rgb: 'rgb(186, 26, 26)',
    hex: '#ba1a1a'
  } as ColorValue,

  /** 错误色（暗色主题） */
  errorDark: {
    css: 'var(--md-sys-color-error)',
    rgb: 'rgb(255, 180, 171)',
    hex: '#ffb4ab'
  } as ColorValue,

  /** 表面色（亮色主题） */
  surface: {
    css: 'var(--md-sys-color-surface)',
    rgb: 'rgb(247, 249, 255)',
    hex: '#f7f9ff'
  } as ColorValue,

  /** 表面色（暗色主题） */
  surfaceDark: {
    css: 'var(--md-sys-color-surface)',
    rgb: 'rgb(16, 20, 24)',
    hex: '#101418'
  } as ColorValue,

  /** 表面上的文本色（亮色主题） */
  onSurface: {
    css: 'var(--md-sys-color-on-surface)',
    rgb: 'rgb(24, 28, 32)',
    hex: '#181c20'
  } as ColorValue,

  /** 表面上的文本色（暗色主题） */
  onSurfaceDark: {
    css: 'var(--md-sys-color-on-surface)',
    rgb: 'rgb(224, 226, 232)',
    hex: '#e0e2e8'
  } as ColorValue
} as const

/**
 * 语义化颜色
 * 
 * 这些颜色来自 semantic-colors.css
 */
export const semanticColors = {
  /** 警告色 */
  warning: {
    css: 'var(--acuity-semantic-warning)',
    rgb: 'rgb(245, 124, 0)',
    hex: '#f57c00'
  } as ColorValue,

  /** 警告容器色 */
  warningContainer: {
    css: 'var(--acuity-semantic-warning-container)',
    rgb: 'rgb(255, 243, 224)',
    hex: '#fff3e0'
  } as ColorValue,

  /** 成功色 */
  success: {
    css: 'var(--acuity-semantic-success)',
    rgb: 'rgb(46, 125, 50)',
    hex: '#2e7d32'
  } as ColorValue,

  /** 成功容器色 */
  successContainer: {
    css: 'var(--acuity-semantic-success-container)',
    rgb: 'rgb(232, 245, 232)',
    hex: '#e8f5e8'
  } as ColorValue,

  /** 信息色 */
  info: {
    css: 'var(--acuity-semantic-info)',
    rgb: 'rgb(25, 118, 210)',
    hex: '#1976d2'
  } as ColorValue,

  /** 信息容器色 */
  infoContainer: {
    css: 'var(--acuity-semantic-info-container)',
    rgb: 'rgb(227, 242, 253)',
    hex: '#e3f2fd'
  } as ColorValue
} as const

/**
 * 强调色/装饰色
 * 
 * 这些颜色来自 semantic-colors.css，用于特殊功能标识
 */
export const accentColors = {
  /** 青色 */
  teal: {
    css: 'var(--acuity-accent-teal)',
    rgb: 'rgb(22, 160, 133)',
    hex: '#16a085'
  } as ColorValue,

  /** 金色 */
  gold: {
    css: 'var(--acuity-accent-gold)',
    rgb: 'rgb(255, 215, 0)',
    hex: '#ffd700'
  } as ColorValue,

  /** 琥珀色 */
  amber: {
    css: 'var(--acuity-accent-amber)',
    rgb: 'rgb(245, 158, 11)',
    hex: '#f59e0b'
  } as ColorValue,

  /** 紫色 */
  purple: {
    css: 'var(--acuity-accent-purple)',
    rgb: 'rgb(192, 38, 211)',
    hex: '#c026d3'
  } as ColorValue,

  /** AI 功能色（映射到紫色） */
  ai: {
    css: 'var(--acuity-accent-ai)',
    rgb: 'rgb(192, 38, 211)',
    hex: '#c026d3'
  } as ColorValue
} as const

/**
 * Primary 色彩系列
 * 
 * 用于渐变、图表、数据可视化等场景
 */
export const primaryScale = {
  50: {
    css: 'var(--acuity-primary-50)',
    rgb: 'rgb(239, 246, 255)',
    hex: '#eff6ff'
  } as ColorValue,
  100: {
    css: 'var(--acuity-primary-100)',
    rgb: 'rgb(219, 234, 254)',
    hex: '#dbeafe'
  } as ColorValue,
  200: {
    css: 'var(--acuity-primary-200)',
    rgb: 'rgb(191, 219, 254)',
    hex: '#bfdbfe'
  } as ColorValue,
  300: {
    css: 'var(--acuity-primary-300)',
    rgb: 'rgb(147, 197, 253)',
    hex: '#93c5fd'
  } as ColorValue,
  400: {
    css: 'var(--acuity-primary-400)',
    rgb: 'rgb(96, 165, 250)',
    hex: '#60a5fa'
  } as ColorValue,
  500: {
    css: 'var(--acuity-primary-500)',
    rgb: 'rgb(59, 130, 246)',
    hex: '#3b82f6'
  } as ColorValue,
  600: {
    css: 'var(--acuity-primary-600)',
    rgb: 'rgb(37, 99, 235)',
    hex: '#2563eb'
  } as ColorValue,
  700: {
    css: 'var(--acuity-primary-700)',
    rgb: 'rgb(29, 78, 216)',
    hex: '#1d4ed8'
  } as ColorValue,
  800: {
    css: 'var(--acuity-primary-800)',
    rgb: 'rgb(30, 64, 175)',
    hex: '#1e40af'
  } as ColorValue,
  900: {
    css: 'var(--acuity-primary-900)',
    rgb: 'rgb(30, 58, 138)',
    hex: '#1e3a8a'
  } as ColorValue
} as const

/**
 * 统一导出所有颜色
 */
export const colors = {
  material: materialColors,
  semantic: semanticColors,
  accent: accentColors,
  primaryScale
} as const

/**
 * 辅助函数：获取颜色的特定格式
 */
export function getColor(color: ColorValue, format: 'css' | 'rgb' | 'hex' = 'css'): string {
  return color[format]
}

/**
 * 辅助函数：根据主题获取颜色
 */
export function getThemeColor(
  lightColor: ColorValue,
  darkColor: ColorValue,
  theme: 'light' | 'dark'
): ColorValue {
  return theme === 'dark' ? darkColor : lightColor
}

/**
 * 类型导出
 */
export type Colors = typeof colors
export type MaterialColors = typeof materialColors
export type SemanticColors = typeof semanticColors
export type AccentColors = typeof accentColors
export type PrimaryScale = typeof primaryScale
