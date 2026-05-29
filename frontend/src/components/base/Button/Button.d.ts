export type ButtonVariant = 'filled' | 'text' | 'outlined' | 'icon' | 'tonal'

export interface ButtonProps {
  /** 按钮变体 */
  variant?: ButtonVariant
  /** 是否禁用 */
  disabled?: boolean
  /** 图标名称（仅 variant='icon' 时有效，也可通过默认 slot 传入 LucideIcon） */
  icon?: string
  /** 图标尺寸 */
  iconSize?: number
  /** 按钮的 aria-label（icon 按钮必须） */
  ariaLabel?: string
  /** 按钮的 title 属性 */
  title?: string
  /** 按钮类型 */
  type?: 'button' | 'submit' | 'reset'
  /** 是否处于 loading 状态 */
  loading?: boolean
  /** trailing 图标名称 */
  trailingIcon?: string
}

export interface ButtonEmits {
  (event: 'click', e: MouseEvent): void
}

export interface ButtonSlots {
  /** 默认内容（文本或图标） */
  default?(): unknown
  /** 前置图标 */
  icon?(): unknown
}
