/**
 * 通知展示层适配器
 *
 * 职责：
 * - 封装通知服务，提供 UI 友好的接口
 * - 统一通知样式和行为
 */

import { notificationService } from '@/application/notification/notification-service'
import { logger } from '@/infrastructure/logging/logger'
import type { NotificationLevel } from '@/types/application/notification'

/**
 * 通知展示层适配器
 */
export class NotificationPresentationAdapter {
  /**
   * 显示成功消息
   *
   * @param message - 消息内容
   */
  showSuccess(message: string, _duration?: number): void {
    notificationService.notifySuccess(message)
  }

  /**
   * 显示错误消息
   *
   * @param message - 消息内容
   */
  showError(message: string, _duration?: number): void {
    notificationService.notifyError(message)
  }

  /**
   * 显示警告消息
   *
   * @param message - 消息内容
   */
  showWarning(message: string, _duration?: number): void {
    notificationService.notifyWarning(message)
  }

  /**
   * 显示信息消息
   *
   * @param message - 消息内容
   */
  showInfo(message: string, _duration?: number): void {
    notificationService.notifyInfo(message)
  }

  /**
   * 显示系统通知（浏览器通知）
   *
   * @param title - 通知标题
   * @param message - 通知内容
   * @param level - 通知级别
   */
  showSystemNotification(title: string, message: string, level: NotificationLevel = 'info'): void {
    try {
      notificationService.notify(message, {
        title,
        level,
        showDesktopNotification: true
      })
    } catch (error) {
      logger.error('NotificationAdapter', '显示系统通知失败', {
        title,
        message,
        error
      })
      // 降级到 Toast
      this.showInfo(`${title}: ${message}`)
    }
  }

  /**
   * 显示加载提示
   *
   * @param message - 加载消息
   * @returns 关闭加载提示的函数
   */
  showLoading(message: string = '加载中...'): () => void {
    // 使用持久化通知
    notificationService.notify(message, {
      level: 'info',
      persistent: true
    })

    return () => {
      // 通知服务会自动处理，这里提供一个占位函数
      // 如果需要真正的关闭功能，需要跟踪通知 ID
    }
  }
}

/**
 * 默认通知适配器实例
 */
export const notificationPresentationAdapter = new NotificationPresentationAdapter()
