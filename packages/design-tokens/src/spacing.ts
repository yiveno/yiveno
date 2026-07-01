/**
 * Yiveno 间距系统
 *
 * 基于 8px 网格系统，确保设计的一致性和可预测性
 */

export const spacing = {
  /** 0px */
  none: '0',
  /** 4px - 极小间距 */
  xs: '0.25rem',
  /** 8px - 小间距 */
  sm: '0.5rem',
  /** 12px - 中小间距 */
  md: '0.75rem',
  /** 16px - 中等间距 */
  base: '1rem',
  /** 24px - 大间距 */
  lg: '1.5rem',
  /** 32px - 超大间距 */
  xl: '2rem',
  /** 48px - 超超大间距 */
  '2xl': '3rem',
  /** 64px - 巨大间距 */
  '3xl': '4rem'
} as const

/**
 * 圆角系统
 */
export const borderRadius = {
  /** 0px - 无圆角 */
  none: '0',
  /** 2px - 微小圆角 */
  xs: '0.125rem',
  /** 4px - 小圆角 */
  sm: '0.25rem',
  /** 8px - 中等圆角 */
  md: '0.5rem',
  /** 12px - 大圆角 */
  lg: '0.75rem',
  /** 16px - 超大圆角 */
  xl: '1rem',
  /** 24px - 超超大圆角 */
  '2xl': '1.5rem',
  /** 完全圆形 */
  full: '9999px'
} as const

/**
 * 阴影系统（多层次，更有质感）
 */
export const shadows = {
  /** 无阴影 */
  none: 'none',
  /** 微小阴影 - 用于悬停状态 */
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  /** 小阴影 - 用于卡片 */
  sm: '0 2px 4px 0 rgba(0, 0, 0, 0.06), 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
  /** 中等阴影 - 用于按钮、输入框 */
  md: '0 4px 8px -2px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  /** 大阴影 - 用于弹出菜单 */
  lg: '0 10px 20px -5px rgba(0, 0, 0, 0.12), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
  /** 超大阴影 - 用于对话框 */
  xl: '0 20px 40px -10px rgba(0, 0, 0, 0.15), 0 8px 16px -4px rgba(0, 0, 0, 0.1)',
  /** 超超大阴影 - 用于模态框 */
  '2xl': '0 30px 60px -15px rgba(0, 0, 0, 0.2), 0 12px 24px -6px rgba(0, 0, 0, 0.12)',
  /** 内阴影 */
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  /** 焦点阴影 - 蓝色 */
  focus: '0 0 0 4px rgba(59, 130, 246, 0.1)',
  /** 焦点阴影 - 紫色（用于 AI 功能） */
  focusSecondary: '0 0 0 4px rgba(192, 38, 211, 0.1)',
  /** 彩色阴影 - 主色 */
  coloredPrimary: '0 4px 16px rgba(59, 130, 246, 0.2), 0 2px 8px rgba(59, 130, 246, 0.1)',
  /** 彩色阴影 - 次要色 */
  coloredSecondary: '0 4px 16px rgba(192, 38, 211, 0.2), 0 2px 8px rgba(192, 38, 211, 0.1)'
} as const

/**
 * Z-index 层级系统
 */
export const zIndex = {
  /** 隐藏 */
  hide: -1,
  /** 基础层 */
  base: 0,
  /** 下拉菜单 */
  dropdown: 1000,
  /** 粘性定位 */
  sticky: 1100,
  /** 固定定位 */
  fixed: 1200,
  /** 模态弹窗背景 */
  modalBackdrop: 1300,
  /** 模态弹窗 */
  modal: 1400,
  /** 弹出提示 */
  popover: 1500,
  /** 提示消息 */
  toast: 1600,
  /** 最高层 */
  highest: 9999
} as const

export type Spacing = typeof spacing
export type BorderRadius = typeof borderRadius
export type Shadows = typeof shadows
export type ZIndex = typeof zIndex
