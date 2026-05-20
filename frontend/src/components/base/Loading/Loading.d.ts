/**
 * Loading 组件属性
 */
export interface LoadingProps {
  /**
   * 尺寸
   * @default 'md'
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'

  /**
   * 是否为不确定进度（转圈动画）
   * @default true
   */
  indeterminate?: boolean

  /**
   * 加载文案（可选）
   * @default undefined
   */
  text?: string
}
