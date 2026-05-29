/** 头像组件类型定义 */
export interface AvatarProps {
  /** 头像的图片源 */
  src?: string
  /** 头像的替代文本 */
  alt?: string
  /** 头像的图标 */
  icon?: string
  /** 头像的文本 */
  text?: string
  /** 头像的大小 */
  size?: number | string
  /** 头像的样式 */
  variant?: 'circle' | 'rounded' | 'square'
} // 头像组件属性

export interface AvatarEmits {} // 头像组件事件
