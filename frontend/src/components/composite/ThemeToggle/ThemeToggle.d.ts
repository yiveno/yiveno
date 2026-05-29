export interface ThemeToggleProps {
  /** 主题 */
  theme: 'light' | 'dark' | 'auto' // 当前主题
  /** 是否禁用 */
  disabled?: boolean
}

export interface ThemeToggleEmits {
  (event: 'change', value: 'light' | 'dark' | 'auto'): void // 主题变化
}
