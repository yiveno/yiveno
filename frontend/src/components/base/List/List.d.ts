export type ListVariant = 'default' | 'menu'
export type ListDivider = 'none' | 'line' | 'inset'

export interface ListProps {
  /** 列表变体 */
  variant?: ListVariant
  /** 分割线类型 */
  divider?: ListDivider
}

export interface ListEmits {
  /** 列表项点击事件 */
  (e: 'itemClick', event: Event): void
}

export interface ListSlots {
  /** 默认插槽（ListItem） */
  default?: () => unknown
}
