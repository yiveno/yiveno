export interface SwitchProps {
  /** 开关状态 */
  modelValue?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 表单 name 属性 */
  name?: string
  /** 表单 value 属性 */
  value?: string
  /** 是否必填 */
  required?: boolean
  /** 仅显示选中图标 */
  showOnlySelectedIcon?: boolean
}

export interface SwitchEmits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'change', event: Event): void
  (e: 'input', event: InputEvent): void
}
