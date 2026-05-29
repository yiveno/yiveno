/**
 * SkeletonTree 树形骨架屏组件属性
 *
 * 用于显示树形结构加载状态的骨架屏
 * 适用于书签树、文件夹树等场景
 */
export interface SkeletonTreeProps {
  /**
   * 显示的骨架屏项数量
   * @default 5
   */
  count?: number;

  /**
   * 树节点高度（支持 CSS 单位）
   * @default '36px'
   */
  nodeHeight?: string | number;

  /**
   * 树节点之间的间距
   * @default 'sm'
   */
  gap?: "none" | "sm" | "md" | "lg";

  /**
   * 是否显示图标
   * @default true
   */
  showIcon?: boolean;

  /**
   * 图标尺寸
   * @default 20
   */
  iconSize?: number;

  /**
   * 是否显示缩进层级
   * @default true
   */
  showIndent?: boolean;

  /**
   * 缩进宽度（每层级）
   * @default 24
   */
  indentWidth?: number;

  /**
   * 动画类型
   * @default 'pulse'
   */
  animation?: "pulse" | "wave" | "none";
}
