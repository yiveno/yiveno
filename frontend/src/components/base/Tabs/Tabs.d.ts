export interface TabsProps {
  /** 当前激活的 tab 索引 */
  modelValue?: number
}

export interface TabsEmits {
  (e: 'update:modelValue', value: number): void
  (e: 'change', event: Event): void
}
