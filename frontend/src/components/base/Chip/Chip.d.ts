export interface ChipProps {
  /** Chip 类型 */
  type?: "assist" | "filter" | "input" | "suggestion";
  /** Chip 的样式 */
  variant?: "filled" | "outlined" | "soft";
  /** Chip 的颜色 */
  color?: "primary" | "secondary" | "success" | "warning" | "error" | "info";
  /** Chip 的大小 */
  size?: "sm" | "md" | "lg";
  /** Chip 的计数 */
  count?: number;
  /** Filter/Input Chip 是否选中 */
  selected?: boolean;
  /** Input Chip 是否可移除 */
  removable?: boolean;
  /** Assist Chip 是否提升样式 */
  elevated?: boolean;
  /** 链接地址 */
  href?: string;
  /** 链接 target */
  target?: "_blank" | "_parent" | "_self" | "_top" | "";
  /** 下载文件名 */
  download?: string;
  /** 是否仅删除 */
  removeOnly?: boolean;
  /** 是否为头像 chip */
  avatar?: boolean;
}

export interface ChipEmits {
  /** Chip 点击事件 */
  click: [event: MouseEvent];
  /** 删除事件 */
  remove: [event: Event];
}
