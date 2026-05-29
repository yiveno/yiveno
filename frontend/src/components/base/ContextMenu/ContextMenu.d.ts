import type { MenuItemConfig } from '@/core/bookmark/context-menu-config'

export interface ContextMenuProps {
  /** 是否显示菜单 */
  show: boolean
  /** 菜单项配置 */
  items: MenuItemConfig[]
  /** 菜单显示的 X 坐标 */
  x: number
  /** 菜单显示的 Y 坐标 */
  y: number
}

export interface ContextMenuEmits {
  /** 菜单项被点击 */
  'item-click': [item: MenuItemConfig]
  /** 关闭菜单 */
  close: []
}
