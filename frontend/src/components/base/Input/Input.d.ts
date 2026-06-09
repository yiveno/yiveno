export interface InputProps {
  /** 输入框的值 */
  modelValue?: string | number
  /** 输入框的模型修饰符 */
  modelModifiers?: {
    number?: boolean
    trim?: boolean
  }
  /** 输入框的标签 */
  label?: string
  /** 输入框的样式变体 */
  variant?: 'outlined' | 'filled'
  /** 输入框的密度 */
  density?: 'default' | 'comfortable' | 'compact'
  /** 输入框的类型 */
  type?: string
  /** 输入框的占位符 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 输入框是否只读 */
  readonly?: boolean
  /** 输入框是否可清除 */
  clearable?: boolean
  /** 输入框的清除值 */
  clearValue?: string | number
  /** 输入框的自动完成 */
  autocomplete?: string
  /** 输入框的 name 属性（用于表单提交和自动填充） */
  name?: string
  /** 输入框的最大长度 */
  maxlength?: number
  /** 输入框的提示文本 */
  hint?: string
  /** 输入框是否错误 */
  error?: boolean
  /** 输入框的错误消息 */
  errorMessage?: string
  /** 输入框的大小 */
  size?: 'sm' | 'md' | 'lg'
  /** 输入框是否加载中 */
  loading?: boolean
  /** 前置图标名称（Lucide 图标） */
  leadingIcon?: string
  /** 前置图标尺寸 */
  leadingIconSize?: number
  /** 后置图标名称（Lucide 图标） */
  trailingIcon?: string
  /** 后置图标尺寸 */
  trailingIconSize?: number
}

export interface InputEmits {
  (event: 'update:modelValue', value: string | number): void
  (event: 'focus', e: FocusEvent): void
  (event: 'blur', e: FocusEvent): void
  (event: 'clear'): void
  (event: 'prefix-click', e: MouseEvent): void
  (event: 'suffix-click', e: MouseEvent): void
  (event: 'input', value: string | number): void
  (event: 'keydown', e: KeyboardEvent): void
  (event: 'trailingIconClick', e: MouseEvent): void
} // 输入框组件事件
