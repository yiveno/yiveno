/**
 * otterSage 动画系统
 *
 * 基于 Material Design 3 动画规范
 * @see https://m3.material.io/styles/motion/overview
 */

/**
 * 动画时长
 */
export const duration = {
  /** 瞬间 - 50ms - 用于微小的状态变化 */
  instant: '50ms',
  /** 极快 - 100ms - 用于小元素的简单过渡 */
  fastest: '100ms',
  /** 很快 - 150ms - 用于小元素的过渡 */
  faster: '150ms',
  /** 快速 - 200ms - 用于中等元素的过渡 */
  fast: '200ms',
  /** 正常 - 300ms - 默认过渡时长 */
  normal: '300ms',
  /** 慢速 - 400ms - 用于大元素的过渡 */
  slow: '400ms',
  /** 很慢 - 500ms - 用于复杂动画 */
  slower: '500ms',
  /** 最慢 - 700ms - 用于页面级过渡 */
  slowest: '700ms'
} as const

/**
 * 缓动函数（Easing）
 * Material Design 3 标准缓动曲线
 */
export const easing = {
  /** 标准 - 用于大多数过渡 */
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  /** 强调 - 用于重要元素的进入 */
  emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  /** 强调减速 - 用于元素进入 */
  emphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  /** 强调加速 - 用于元素退出 */
  emphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  /** 线性 - 用于持续动画 */
  linear: 'linear',
  /** 缓入 - 元素退出 */
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  /** 缓出 - 元素进入 */
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  /** 缓入缓出 - 元素移动 */
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  /** 弹性 - 用于有趣的交互 */
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** 回弹 - 用于错误提示 */
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
} as const

/**
 * 预设动画配置
 * 常用的动画组合
 */
export const presets = {
  /** 淡入淡出 */
  fade: {
    duration: duration.fast,
    easing: easing.standard
  },
  /** 滑入滑出 */
  slide: {
    duration: duration.normal,
    easing: easing.emphasizedDecelerate
  },
  /** 缩放 */
  scale: {
    duration: duration.fast,
    easing: easing.emphasizedDecelerate
  },
  /** 旋转 */
  rotate: {
    duration: duration.normal,
    easing: easing.standard
  },
  /** 弹跳 */
  bounce: {
    duration: duration.slow,
    easing: easing.bounce
  },
  /** 弹性 */
  spring: {
    duration: duration.normal,
    easing: easing.spring
  }
} as const

/**
 * 关键帧动画名称
 * 用于 CSS @keyframes
 */
export const keyframes = {
  /** 淡入 */
  fadeIn: 'fadeIn',
  /** 淡出 */
  fadeOut: 'fadeOut',
  /** 从上滑入 */
  slideInUp: 'slideInUp',
  /** 从下滑入 */
  slideInDown: 'slideInDown',
  /** 从左滑入 */
  slideInLeft: 'slideInLeft',
  /** 从右滑入 */
  slideInRight: 'slideInRight',
  /** 缩放进入 */
  scaleIn: 'scaleIn',
  /** 缩放退出 */
  scaleOut: 'scaleOut',
  /** 旋转 */
  spin: 'spin',
  /** 脉冲 */
  pulse: 'pulse',
  /** 摇晃 */
  shake: 'shake',
  /** 弹跳 */
  bounce: 'bounce',
  /** 闪烁 */
  blink: 'blink',
  /** 波纹扩散 */
  ripple: 'ripple',
  /** 骨架屏闪烁 */
  shimmer: 'shimmer'
} as const

export type Duration = typeof duration
export type Easing = typeof easing
export type Presets = typeof presets
export type Keyframes = typeof keyframes
