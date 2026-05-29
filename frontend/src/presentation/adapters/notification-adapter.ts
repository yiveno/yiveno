/**
 * 通知展示层适配器
 *
 * 职责：
 * - 封装通知服务，提供 UI 友好的接口
 * - 统一通知样式和行为
 * - 智能选择 Message（轻量级）或 Notification（详细）
 */

import { notificationService } from '@/application/notification/notification-service'
import { message } from '@/application/message/message-service'
import { logger } from '@/infrastructure/logging/logger'
import type { NotificationLevel } from '@/types/application/notification'

/**
 * 通知展示层适配器
 */
export class NotificationPresentationAdapter {
  /**
   * 显示成功消息（轻量级提示）
   *
   * @param msg - 消息内容
   */
  showSuccess(msg: string, _duration?: number): void {
    message.success(msg)
  }

  /**
   * 显示错误消息（轻量级提示）
   *
   * @param msg - 消息内容
   */
  showError(msg: string, _duration?: number): void {
    message.error(msg)
  }

  /**
   * 显示警告消息（轻量级提示）
   *
   * @param msg - 消息内容
   */
  showWarning(msg: string, _duration?: number): void {
    message.warning(msg)
  }

  /**
   * 显示信息消息（轻量级提示）
   *
   * @param msg - 消息内容
   */
  showInfo(msg: string, _duration?: number): void {
    message.info(msg)
  }

  /**
   * 显示系统通知（浏览器通知）
   *
   * @param title - 通知标题
   * @param message - 通知内容
   * @param level - 通知级别
   */
  showSystemNotification(title: string, msg: string, level: NotificationLevel = 'info'): void {
    try {
      notificationService.notify(msg, {
        title,
        level,
        showDesktopNotification: true
      })
    } catch (error) {
      logger.error('NotificationAdapter', '显示系统通知失败', {
        title,
        message: msg,
        error
      })
      // 降级到 Toast
      this.showInfo(`${title}: ${msg}`)
    }
  }

  /**
   * 显示加载提示
   *
   * @param message - 加载消息
   * @returns 关闭加载提示的函数
   */
  showLoading(msg: string = '加载中...'): () => void {
    // 使用持久化通知
    notificationService.notify(msg, {
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
