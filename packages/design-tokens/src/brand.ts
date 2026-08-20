/**
 * Yiveno Brand Core 常量（TS 侧：Canvas / Badge / 无 CSS 变量场景）。
 * CSS 权威：`@yiveno/design-tokens/css/brand.css`
 * 规范：docs/design/Yiveno-设计标准-v1.md §2
 */

/** Brand Core hex / 派生说明（与 CSS :root 一一对应） */
export const brandCore = {
  /** 品牌深色 */
  ink: '#192420',
  /** 深色变体 */
  inkMid: '#1e2c26',
  /** 品牌浅底 */
  paper: '#f0f3ee',
  /** 浅底交替 */
  paperDim: '#e8ece5',
  /** 浅底主文字 */
  charcoal: '#222c24',
  /** 次级文字 */
  muted: '#586860',
  /** 分割线 */
  border: '#ced8cb',
  /** 品牌强调 / 主操作 */
  sage: '#4b6054',
  /** 强调悬停 */
  sageDark: '#3a4e44',
  /** 弱强调 */
  sageMuted: '#82998c',
  /** 极弱强调 */
  sageFaint: '#c6d6ca',
  /** 强调色上的前景 */
  sageOn: '#d8ede2',
  /** 深底主文字 */
  heroFg: '#dce8de',
  /** 错误（克制暖棕） */
  danger: '#a05a3c'
} as const

export type BrandCoreKey = keyof typeof brandCore
