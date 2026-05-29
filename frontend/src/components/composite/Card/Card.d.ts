export interface CardProps {
  /** 卡片标题 (可选) */
  title?: string;
  /** 卡片副标题 (可选) */
  subtitle?: string;
  /** 卡片图标 (可选) */
  icon?: string;
  /** 卡片图标颜色 (可选) */
  iconColor?: string;
  /** 卡片样式 */
  variant?:
    | "default"
    | "outlined"
    | "elevated"
    | "warning"
    | "danger"
    | "success";
  /** 卡片大小 */
  size?: "sm" | "md" | "lg";
  /** 卡片是否无边框 */
  borderless?: boolean;
  /** 卡片是否内边距 */
  padding?: boolean;
  /** 卡片是否悬浮 */
  hover?: boolean;
  /** 卡片是否可点击 */
  clickable?: boolean;
  /** 卡片底部过渡效果 */
  footerTransition?: "fade" | "slide" | "none" | string;
  /** 卡片底部是否可见 */
  footerVisible?: boolean;
} // 卡片组件属性

export interface CardEmits {
  /** 卡片点击事件 */
  click: [event: Event];
} // 卡片组件事件
