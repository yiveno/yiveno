/**
 * SkeletonList 列表骨架屏组件属性
 *
 * 用于显示列表加载状态的骨架屏
 * 适用于通知列表、搜索结果列表等场景
 */
export interface SkeletonListProps {
  /**
   * 显示的骨架屏项数量
   * @default 3
   */
  count?: number;

  /**
   * 列表项高度（支持 CSS 单位）
   * @default '60px'
   */
  itemHeight?: string | number;

  /**
   * 列表项之间的间距
   * @default 'md'
   */
  gap?: "none" | "sm" | "md" | "lg";

  /**
   * 是否显示头像/图标
   * @default true
   */
  showAvatar?: boolean;

  /**
   * 头像尺寸
   * @default 40
   */
  avatarSize?: number;

  /**
   * 是否显示次要文本（副标题）
   * @default true
   */
  showSecondary?: boolean;

  /**
   * 是否显示操作按钮区域
   * @default false
   */
  showActions?: boolean;

  /**
   * 动画类型
   * @default 'pulse'
   */
  animation?: "pulse" | "wave" | "none";
}
