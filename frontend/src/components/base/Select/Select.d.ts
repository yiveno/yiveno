export type SelectVariant = 'outlined' | 'filled'

export interface SelectOption {
  /** 选项值 */
  value: string | number
  /** 选项标签 */
  label: string
  /** 选项描述（可选） */
  description?: string
  /** 是否禁用 */
  disabled?: boolean
}

export interface SelectProps {
  /** v-model 绑定值 */
  modelValue?: string | number | undefined
  /** 标签 */
  label?: string
  /** 占位符 */
  placeholder?: string
  /** 变体 */
  variant?: SelectVariant
  /** 是否禁用 */
  disabled?: boolean
  /** 是否必填 */
  required?: boolean
  /** 错误状态 */
  error?: boolean
  /** 错误消息 */
  errorMessage?: string
  /** 提示文本 */
  hint?: string
  /** 选项列表 */
  options?: SelectOption[]
  /** name 属性 */
  name?: string
}

export interface SelectEmits {
  /** v-model 更新事件 */
  (e: 'update:modelValue', value: string | number): void
  /** 原生 change 事件 */
  (e: 'change', event: Event): void
  /** 原生 input 事件 */
  (e: 'input', event: Event): void
}

export interface SelectSlots {
  /** 默认插槽（md-select-option） */
  default?: () => unknown
}
