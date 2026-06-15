export interface SliderProps {
  /** v-model 绑定值 */
  modelValue?: number
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 步长 */
  step?: number
  /** 是否禁用 */
  disabled?: boolean
  /** 是否显示刻度标记 */
  ticks?: boolean
  /** 是否标记 */
  labeled?: boolean
  /** 是否显示范围标签 */
  withRangeLabel?: boolean
  /** 自定义格式化函数（用于显示值） */
  formatValue?: (value: number) => string
  /** name 属性 */
  name?: string
  /** aria-label */
  ariaLabel?: string
}

export interface SliderEmits {
  /** v-model 更新事件 */
  (e: 'update:modelValue', value: number): void
  /** 原生 input 事件（拖动中） */
  (e: 'input', event: Event): void
  /** 原生 change 事件（拖动完成） */
  (e: 'change', event: Event): void
}

export interface SliderSlots {
  /** 自定义值显示 */
  value?: (props: { value: number; formatted: string }) => unknown
}
