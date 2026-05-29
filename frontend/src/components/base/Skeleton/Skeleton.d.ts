/**
 * Skeleton 骨架屏组件属性
 *
 * 基于 Material Design 3 设计规范
 * 用于在内容加载时显示占位符，提升用户体验
 */
export interface SkeletonProps {
  /**
   * 骨架屏变体
   * - text: 文本行（默认）
   * - circular: 圆形（头像、图标）
   * - rectangular: 矩形（卡片、图片）
   * - rounded: 圆角矩形（按钮、标签）
   * @default 'text'
   */
  variant?: "text" | "circular" | "rectangular" | "rounded";

  /**
   * 宽度（支持 CSS 单位）
   * @default undefined（自动填充父容器）
   */
  width?: string | number;

  /**
   * 高度（支持 CSS 单位）
   * @default undefined（根据 variant 自动计算）
   */
  height?: string | number;

  /**
   * 动画类型
   * - pulse: 脉冲动画（默认，Material Design 推荐）
   * - wave: 波浪动画（从左到右扫过）
   * - none: 无动画（静态占位符）
   * @default 'pulse'
   */
  animation?: "pulse" | "wave" | "none";

  /**
   * 圆角大小（仅 rounded 变体有效）
   * @default 'md'
   */
  borderRadius?: "sm" | "md" | "lg" | "full";
}
