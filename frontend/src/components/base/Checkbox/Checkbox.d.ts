export type CheckboxVariant = 'default' | 'folder' | 'bookmark'
export type CheckboxSize = 'sm' | 'md' | 'lg'

export interface CheckboxProps {
  /** 是否选中 */
  modelValue?: boolean
  /** 不确定状态（用于全选/部分选中） */
  indeterminate?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 颜色变体 */
  variant?: CheckboxVariant
  /** 尺寸 */
  size?: CheckboxSize
  /** 原生 name 属性 */
  name?: string
  /** 原生 value 属性 */
  value?: string
  /** 是否必填 */
  required?: boolean
  /** aria-label */
  ariaLabel?: string
}

export interface CheckboxEmits {
  /** v-model 更新事件 */
  (e: 'update:modelValue', value: boolean): void
  /** 原生 change 事件 */
  (e: 'change', event: Event): void
  /** 原生 input 事件 */
  (e: 'input', event: InputEvent): void
}
