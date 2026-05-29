export interface LucideIconProps {
  /** 图标名称 */
  name: string;
  /** 图标大小 */
  size?: number | "xs" | "sm" | "md" | "lg" | "xl" | undefined;
  /** 图标颜色 */
  color?: string | undefined;
  /** 线条宽度 */
  strokeWidth?: number | undefined;
  /** 是否旋转动画 */
  spin?: boolean | undefined;
  /** 水平翻转 */
  flipH?: boolean | undefined;
  /** 垂直翻转 */
  flipV?: boolean | undefined;
  /** 旋转角度 */
  rotate?: number | undefined;
}
