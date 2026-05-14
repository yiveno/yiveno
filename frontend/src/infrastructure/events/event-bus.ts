/**
 * 应用级事件总线（基于 mitt）
 *
 * 职责：
 * - 提供类型安全的事件发布/订阅
 * - 解耦组件间通信
 * - 统一管理应用级事件
 *
 * 使用场景：
 * - 跨组件通信（替代 props drilling）
 * - Background Script 到前端的消息传递
 * - 数据同步事件通知
 */

import mitt from 'mitt'
import type { ColorPresetId } from '@acuity-bookmarks/design-tokens/color-presets'
import type { BookmarkNode } from '@/types/domain/bookmark'

/**
 * 应用事件类型定义
 *
 * 所有事件都需要在这里定义类型，确保类型安全
 */
export interface AppEvents extends Record<string | symbol, unknown> {
  /**
   * 书签更新事件
   * 来源：Background Script 通过 chrome.runtime.onMessage 推送
   */
  'bookmark:updated': {
    id: string
    changes: Partial<BookmarkNode>
  }

  /**
   * 数据同步完成事件
   * （从 Background Script 同步到 IndexedDB）
   */
  'data:synced': {
    eventType: 'created' | 'changed' | 'moved' | 'removed'
    bookmarkId: string
    timestamp: number
  }

  /**
   * 全量同步完成事件
   */
  'sync:completed': {
    duration: number
    count: number
  }

  /**
   * 用户登录事件
   */
  'auth:logged-in': {
    email?: string
    tier?: 'free' | 'pro'
  }

  /**
   * 用户退出登录事件
   */
  'auth:logged-out': Record<string, never>

  /**
   * 配色预设变更（与亮/暗 `data-theme` 正交）
   */
  'colorPreset:changed': { preset: ColorPresetId }
}

/**
 * 全局事件总线实例
 */
export const eventBus = mitt<AppEvents>()

/**
 * 类型安全的事件发射函数
 *
 * @example
 * ```typescript
 * emitEvent('bookmark:updated', {
 *   id: '123',
 *   changes: { title: '新标题' }
 * })
 * ```
 */
export function emitEvent<K extends keyof AppEvents>(
  type: K,
  payload: AppEvents[K]
) {
  eventBus.emit(type, payload)
}

/**
 * 类型安全的事件监听函数
 *
 * @returns 取消监听的函数
 *
 * @example
 * ```typescript
 * const unsubscribe = onEvent('bookmark:updated', (data) => {
 *   console.log('书签更新:', data.id, data.changes)
 * })
 *
 * // 取消监听
 * unsubscribe()
 * ```
 */
export function onEvent<K extends keyof AppEvents>(
  type: K,
  handler: (payload: AppEvents[K]) => void
): () => void {
  eventBus.on(type, handler)

  // 返回取消监听的函数
  return () => {
    eventBus.off(type, handler)
  }
}

/**
 * 一次性事件监听
 *
 * @example
 * ```typescript
 * onceEvent('sync:completed', (data) => {
 *   console.log('同步完成，耗时:', data.duration)
 * })
 * ```
 */
export function onceEvent<K extends keyof AppEvents>(
  type: K,
  handler: (payload: AppEvents[K]) => void
) {
  const wrapper = (payload: AppEvents[K]) => {
    handler(payload)
    eventBus.off(type, wrapper)
  }

  eventBus.on(type, wrapper)
}

/**
 * 清除所有事件监听器
 *
 * ⚠️ 谨慎使用，通常只在应用卸载时调用
 */
export function clearAllListeners() {
  eventBus.all.clear()
}
