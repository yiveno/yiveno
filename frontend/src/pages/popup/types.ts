/**
 * 📄 Popup - 弹出窗口页面类型定义
 */

/** 需要关注的问题类型 */
export type PopupIssueType = 'duplicate' | 'invalid'

/** 管理页筛选键 */
export type PopupFilterKey = PopupIssueType | 'dead' | 'internal'
