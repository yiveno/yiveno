export type LinearProgressSize = 'xs' | 'sm' | 'md' | 'lg'
export type LinearProgressVariant = 'primary' | 'success' | 'warning' | 'error'

export interface LinearProgressProps {
  /** 进度值（0-1），undefined 时显示不确定状态 */
  value?: number | undefined
  /** 尺寸变体 */
  size?: LinearProgressSize
  /** 颜色变体 */
  variant?: LinearProgressVariant
  /** 是否显示不确定状态动画 */
  indeterminate?: boolean
  /** 是否显示进度百分比文本 */
  showPercentage?: boolean
  /** 自定义百分比格式化函数 */
  formatPercentage?: (value: number) => string
  /** 四舍五入精度（默认 0，即整数） */
  roundPrecision?: number
  /** aria-label */
  ariaLabel?: string
}

export interface LinearProgressEmits {
  /** 进度值变化事件（如果需要） */
  (e: 'change', value: number): void
}

export interface LinearProgressSlots {
  /** 自定义百分比显示内容 */
  percentage?: (props: { value: number; formatted: string }) => unknown
}
