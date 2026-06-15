export type MenuSize = 'sm' | 'md' | 'lg'
export type MenuAnchorCorner = 'start-start' | 'start-end' | 'end-start' | 'end-end'

export interface MenuProps {
  /** 是否打开 */
  open?: boolean
  /** 锚点元素（触发按钮） */
  anchor?: string
  /** 锚点对齐角 */
  anchorCorner?: MenuAnchorCorner
  /** 菜单对齐角 */
  menuCorner?: MenuAnchorCorner
  /** 尺寸变体 */
  size?: MenuSize
  /** 是否固定定位 */
  fixed?: boolean
  /** 是否快速打开（无动画） */
  quick?: boolean
  /** 是否有类型提前（菜单项） */
  hasOverflow?: boolean
  /** 保持打开状态（选中项后不关闭） */
  stayOpenOnOutsideClick?: boolean
  /** 保持打开在获得焦点时 */
  stayOpenOnFocusout?: boolean
  /** 跳过还原焦点 */
  skipRestoreFocus?: boolean
}

export interface MenuEmits {
  /** 打开事件 */
  (e: 'opened'): void
  /** 关闭事件 */
  (e: 'closed'): void
  /** 打开中事件 */
  (e: 'opening'): void
  /** 关闭中事件 */
  (e: 'closing'): void
}

export interface MenuSlots {
  /** 默认插槽（MenuItem） */
  default?: () => unknown
}
