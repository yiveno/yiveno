/**
 * 使用通知的组合式函数
 *
 * 提供统一的通知接口，简化组件中的通知调用
 */

import { notificationPresentationAdapter } from '@/presentation/adapters/notification-adapter'

/**
 * 通知组合式函数
 *
 * @example
 * ```typescript
 * const notify = useNotification()
 *
 * // 显示成功消息
 * notify.success('操作成功')
 *
 * // 显示错误消息
 * notify.error('操作失败')
 *
 * // 显示加载提示
 * const closeLoading = notify.loading('正在保存...')
 * // ... 执行操作
 * closeLoading()
 * ```
 */
export function useNotification() {
  return {
    /**
     * 显示成功消息
     */
    success: (message: string, duration?: number) => {
      notificationPresentationAdapter.showSuccess(message, duration)
    },

    /**
     * 显示错误消息
     */
    error: (message: string, duration?: number) => {
      notificationPresentationAdapter.showError(message, duration)
    },

    /**
     * 显示警告消息
     */
    warning: (message: string, duration?: number) => {
      notificationPresentationAdapter.showWarning(message, duration)
    },

    /**
     * 显示信息消息
     */
    info: (message: string, duration?: number) => {
      notificationPresentationAdapter.showInfo(message, duration)
    },

    /**
     * 显示加载提示
     */
    loading: (message: string = '加载中...') => {
      return notificationPresentationAdapter.showLoading(message)
    },

    /**
     * 显示系统通知
     */
    notification: (
      title: string,
      message: string,
      level: 'info' | 'success' | 'warning' | 'error' = 'info'
    ) => {
      notificationPresentationAdapter.showSystemNotification(title, message, level)
    }
  }
}
