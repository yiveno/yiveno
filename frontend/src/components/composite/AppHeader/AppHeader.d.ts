export interface AppHeaderAction {
  /** 唯一标识 */
  id: string
  /** 图标名称（当使用默认按钮时） */
  icon?: string
  /** 按钮文本描述 */
  label?: string
  /** 悬停提示语 */
  tooltip?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 自定义组件（如 ThemeToggle） */
  component?: unknown
  /** 传递给自定义组件的 props */
  props?: Record<string, unknown>
}

export interface AppHeaderProps {
  /** 是否显示侧边栏切换按钮 */
  showSidePanelToggle?: boolean
  /** 是否显示Logo */
  showLogo?: boolean
  /** 是否显示主题切换按钮 */
  showTheme?: boolean
  /** 是否显示设置按钮 */
  showSettings?: boolean
  /** 是否显示账号按钮 */
  showAccount?: boolean
}

export interface AppHeaderEmits {
  (event: 'open-settings'): void
}

export interface AppHeaderSlots {
  /** 图标插槽 */
  icon?: () => unknown
  /** 操作按钮插槽 */
  actions?: () => unknown
}
