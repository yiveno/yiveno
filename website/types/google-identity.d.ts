/**
 * Google Identity Services (GIS) 类型定义
 *
 * 参考：https://developers.google.com/identity/gsi/web/reference/js-reference
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          /**
           * 初始化 Google Identity Services
           */
          initialize(config: GoogleIdentityConfig): void

          /**
           * 显示 One Tap 提示
           */
          prompt(callback?: (notification: GooglePromptNotification) => void): void

          /**
           * 渲染登录按钮
           */
          renderButton(parent: HTMLElement, options: GoogleButtonConfig): void

          /**
           * 取消 One Tap 提示
           */
          cancel(): void

          /**
           * 禁用自动选择
           */
          disableAutoSelect(): void

          /**
           * 撤销授权
           */
          revoke(hint: string, callback: (response: GoogleRevokeResponse) => void): void
        }
      }
    }
  }
}

/**
 * Google Identity Services 初始化配置
 */
interface GoogleIdentityConfig {
  /**
   * OAuth 2.0 客户端 ID
   */
  client_id: string

  /**
   * 登录回调函数
   */
  callback: (response: GoogleCredentialResponse) => void

  /**
   * 是否自动选择账号
   * @default false
   */
  auto_select?: boolean

  /**
   * 点击外部是否取消
   * @default true
   */
  cancel_on_tap_outside?: boolean

  /**
   * 上下文类型
   * - signin: 登录
   * - signup: 注册
   * - use: 使用
   * @default 'signin'
   */
  context?: 'signin' | 'signup' | 'use'

  /**
   * UX 模式
   * - popup: 弹窗
   * - redirect: 重定向
   * @default 'popup'
   */
  ux_mode?: 'popup' | 'redirect'

  /**
   * 登录 URI（redirect 模式使用）
   */
  login_uri?: string

  /**
   * 原生回调（移动端）
   */
  native_callback?: (response: GoogleCredentialResponse) => void

  /**
   * 是否支持 Intelligent Tracking Prevention
   * @default false
   */
  itp_support?: boolean

  /**
   * 中间件 URI
   */
  intermediate_iframe_close_callback?: () => void

  /**
   * 允许的父域名
   */
  allowed_parent_origin?: string | string[]

  /**
   * 状态 Cookie 域名
   */
  state_cookie_domain?: string

  /**
   * 是否使用 FedCM
   * @default false
   */
  use_fedcm_for_prompt?: boolean
}

/**
 * Google 凭证响应
 */
interface GoogleCredentialResponse {
  /**
   * JWT ID Token
   */
  credential: string

  /**
   * 选择的方式
   * - auto: 自动选择
   * - user: 用户选择
   * - user_1tap: One Tap
   * - user_2tap: 两次点击
   * - btn: 按钮点击
   * - btn_confirm: 确认按钮
   * - brn_add_session: 添加会话
   * - btn_confirm_add_session: 确认添加会话
   */
  select_by?:
    | 'auto'
    | 'user'
    | 'user_1tap'
    | 'user_2tap'
    | 'btn'
    | 'btn_confirm'
    | 'btn_add_session'
    | 'btn_confirm_add_session'

  /**
   * 客户端 ID
   */
  clientId?: string
}

/**
 * One Tap 提示通知
 */
interface GooglePromptNotification {
  /**
   * 是否未显示
   */
  isNotDisplayed(): boolean

  /**
   * 获取未显示原因
   * - browser_not_supported: 浏览器不支持
   * - invalid_client: 无效客户端
   * - missing_client_id: 缺少客户端 ID
   * - opt_out_or_no_session: 用户选择退出或无会话
   * - secure_http_required: 需要 HTTPS
   * - suppressed_by_user: 用户抑制
   * - unregistered_origin: 未注册的来源
   * - unknown_reason: 未知原因
   */
  getNotDisplayedReason():
    | 'browser_not_supported'
    | 'invalid_client'
    | 'missing_client_id'
    | 'opt_out_or_no_session'
    | 'secure_http_required'
    | 'suppressed_by_user'
    | 'unregistered_origin'
    | 'unknown_reason'
    | ''

  /**
   * 是否跳过时刻
   */
  isSkippedMoment(): boolean

  /**
   * 获取跳过原因
   * - auto_cancel: 自动取消
   * - user_cancel: 用户取消
   * - tap_outside: 点击外部
   * - issuing_failed: 发行失败
   */
  getSkippedReason(): 'auto_cancel' | 'user_cancel' | 'tap_outside' | 'issuing_failed' | ''

  /**
   * 是否关闭时刻
   */
  isDismissedMoment(): boolean

  /**
   * 获取关闭原因
   * - credential_returned: 凭证已返回
   * - cancel_called: 调用了取消
   * - flow_restarted: 流程重启
   */
  getDismissedReason(): 'credential_returned' | 'cancel_called' | 'flow_restarted' | ''

  /**
   * 获取时刻类型
   * - display: 显示
   * - skipped: 跳过
   * - dismissed: 关闭
   */
  getMomentType(): 'display' | 'skipped' | 'dismissed' | ''
}

/**
 * Google 按钮配置
 */
interface GoogleButtonConfig {
  /**
   * 按钮类型
   * - standard: 标准
   * - icon: 图标
   * @default 'standard'
   */
  type?: 'standard' | 'icon'

  /**
   * 按钮主题
   * - outline: 轮廓
   * - filled_blue: 蓝色填充
   * - filled_black: 黑色填充
   * @default 'outline'
   */
  theme?: 'outline' | 'filled_blue' | 'filled_black'

  /**
   * 按钮大小
   * - large: 大
   * - medium: 中
   * - small: 小
   * @default 'large'
   */
  size?: 'large' | 'medium' | 'small'

  /**
   * 按钮文本
   * - signin_with: 使用 Google 登录
   * - signup_with: 使用 Google 注册
   * - continue_with: 使用 Google 继续
   * - signin: 登录
   * @default 'signin_with'
   */
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'

  /**
   * 按钮形状
   * - rectangular: 矩形
   * - pill: 药丸形
   * - circle: 圆形（仅 icon 类型）
   * - square: 方形（仅 icon 类型）
   * @default 'rectangular'
   */
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'

  /**
   * Logo 对齐方式
   * - left: 左对齐
   * - center: 居中
   * @default 'left'
   */
  logo_alignment?: 'left' | 'center'

  /**
   * 按钮宽度（像素）
   */
  width?: number

  /**
   * 区域设置
   */
  locale?: string
}

/**
 * Google 撤销响应
 */
interface GoogleRevokeResponse {
  /**
   * 是否成功
   */
  successful: boolean

  /**
   * 错误信息
   */
  error?: string
}

export {}
