/**
 * Material Design 3 Tooltip 组件属性
 *
 * 支持两种类型：
 * - Plain Tooltip: 简单文本提示
 * - Rich Tooltip: 富文本提示（通过 content slot 传入）
 */
export interface TooltipProps {
  /**
   * 简单文本内容（Plain Tooltip）
   * 如需富文本，请使用 content slot
   */
  text?: string

  /**
   * Tooltip 位置
   * @default 'top'
   */
  placement?: 'top' | 'bottom' | 'left' | 'right'

  /**
   * 显示延迟（毫秒）
   * MD3 推荐 500ms
   * @default 500
   */
  delay?: number

  /**
   * 是否禁用
   * @default false
   */
  disabled?: boolean

  /**
   * 与触发元素的偏移量
   * MD3 推荐使用 sm (8px)
   * @default 'sm'
   */
  offset?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

export type TooltipEmits = Record<string, never>
