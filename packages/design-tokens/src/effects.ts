/**
 * Yiveno 视觉效果系统
 *
 * 包含玻璃态、模糊、渐变等现代视觉效果
 */

/**
 * 玻璃态效果（Glassmorphism）
 * 用于创建半透明、模糊的现代 UI
 */
export const glassmorphism = {
  /** 轻度玻璃态 - 用于卡片 */
  light: {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.08)'
  },
  /** 中度玻璃态 - 用于弹窗 */
  medium: {
    background: 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.12)'
  },
  /** 重度玻璃态 - 用于模态框 */
  heavy: {
    background: 'rgba(255, 255, 255, 0.3)',
    backdropFilter: 'blur(30px) saturate(200%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.16)'
  },
  /** 深色玻璃态 - 用于深色模式 */
  dark: {
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
  }
} as const

/**
 * 模糊效果
 */
export const blur = {
  /** 无模糊 */
  none: 'blur(0)',
  /** 微小模糊 */
  xs: 'blur(2px)',
  /** 小模糊 */
  sm: 'blur(4px)',
  /** 中等模糊 */
  md: 'blur(8px)',
  /** 大模糊 */
  lg: 'blur(12px)',
  /** 超大模糊 */
  xl: 'blur(16px)',
  /** 超超大模糊 */
  '2xl': 'blur(24px)',
  /** 极大模糊 */
  '3xl': 'blur(40px)'
} as const

/**
 * 渐变效果
 */
export const gradients = {
  /** 品牌渐变 - 蓝紫渐变 */
  brand: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #C026D3 100%)',
  /** 品牌渐变（垂直） */
  brandVertical: 'linear-gradient(180deg, #3B82F6 0%, #8B5CF6 50%, #C026D3 100%)',
  /** 品牌渐变（径向） */
  brandRadial: 'radial-gradient(circle, #3B82F6 0%, #8B5CF6 50%, #C026D3 100%)',

  /** 微妙渐变 - 用于背景 */
  subtle: 'linear-gradient(180deg, rgba(59, 130, 246, 0.05) 0%, rgba(192, 38, 211, 0.05) 100%)',
  /** 微妙渐变（反向） */
  subtleReverse:
    'linear-gradient(180deg, rgba(192, 38, 211, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',

  /** 光泽效果 - 用于按钮 */
  shine: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%)',
  /** 光泽效果（垂直） */
  shineVertical:
    'linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%)',

  /** 深色渐变 - 用于遮罩 */
  dark: 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.8) 100%)',
  /** 深色渐变（反向） */
  darkReverse: 'linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0) 100%)',

  /** 彩虹渐变 - 用于装饰 */
  rainbow:
    'linear-gradient(90deg, #ff0000 0%, #ff7f00 16.67%, #ffff00 33.33%, #00ff00 50%, #0000ff 66.67%, #4b0082 83.33%, #9400d3 100%)'
} as const

/**
 * 滤镜效果
 */
export const filters = {
  /** 无滤镜 */
  none: 'none',
  /** 灰度 */
  grayscale: 'grayscale(100%)',
  /** 半灰度 */
  grayscaleHalf: 'grayscale(50%)',
  /** 模糊 */
  blur: 'blur(8px)',
  /** 亮度增加 */
  brighten: 'brightness(1.2)',
  /** 亮度降低 */
  darken: 'brightness(0.8)',
  /** 对比度增加 */
  contrast: 'contrast(1.2)',
  /** 饱和度增加 */
  saturate: 'saturate(1.5)',
  /** 饱和度降低 */
  desaturate: 'saturate(0.5)',
  /** 色相旋转 */
  hueRotate: 'hue-rotate(90deg)',
  /** 反色 */
  invert: 'invert(100%)',
  /** 棕褐色 */
  sepia: 'sepia(100%)'
} as const

/**
 * 背景图案
 */
export const patterns = {
  /** 点状图案 */
  dots: 'radial-gradient(circle, rgba(0, 0, 0, 0.1) 1px, transparent 1px)',
  /** 网格图案 */
  grid: 'linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)',
  /** 对角线图案 */
  diagonal:
    'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0, 0, 0, 0.05) 10px, rgba(0, 0, 0, 0.05) 20px)',
  /** 波浪图案 */
  waves:
    'repeating-radial-gradient(circle at 0 0, transparent 0, rgba(0, 0, 0, 0.05) 10px, transparent 20px)'
} as const

/**
 * 混合模式
 */
export const blendModes = {
  normal: 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  colorDodge: 'color-dodge',
  colorBurn: 'color-burn',
  hardLight: 'hard-light',
  softLight: 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity'
} as const

export type Glassmorphism = typeof glassmorphism
export type Blur = typeof blur
export type Gradients = typeof gradients
export type Filters = typeof filters
export type Patterns = typeof patterns
export type BlendModes = typeof blendModes
