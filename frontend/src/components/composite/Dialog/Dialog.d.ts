export interface DialogProps {
  /** 是否显示 */
  modelValue?: boolean
  /** 标题文案 */
  title?: string
  /** 标题左侧图标 */
  icon?: string
  /** 标题图标颜色 */
  iconColor?: string
  /** 宽度（便捷属性，会映射到 maxWidth） */
  width?: string
  /** 最大宽度 */
  maxWidth?: string
  /** 最小宽度 */
  minWidth?: string
  /** 是否阻止外部关闭 */
  persistent?: boolean
  /** 是否启用 md-dialog 的 quick 模式（弱化动效等，见 Material Web 文档） */
  dense?: boolean
  /** 是否全屏 */
  fullscreen?: boolean
  /** 是否允许正文滚动 */
  scrollable?: boolean
  /** 回车提交 */
  enterToConfirm?: boolean
  /** ESC关闭 */
  escToClose?: boolean
  /** 主体最小高度 */
  bodyMinHeight?: string
  /** 是否允许取消 */
  cancelable?: boolean
  /** 取消前是否校验 */
  enableCancelGuard?: boolean
  /** 取消确认提示文案 */
  cancelConfirmText?: string
  /** 取消确认按钮 */
  cancelConfirmOkText?: string
  /** 取消继续编辑按钮 */
  cancelConfirmContinueText?: string
  /** Teleport 目标 */
  teleportTarget?: string
  /** 点击蒙层关闭 */
  closeOnOverlay?: boolean
  /** 隐藏关闭按钮 */
  hideClose?: boolean
  /** 兼容 show 控制 */
  show?: boolean
}

export interface DialogEmits {
  (event: 'update:modelValue', value: boolean): void
  /** 更新显隐 */
  (event: 'update:show', value: boolean): void
  /** 打开 */
  (event: 'open'): void
  /** 关闭 */
  (event: 'close'): void
  /** 确认 */
  (event: 'confirm'): void
}
