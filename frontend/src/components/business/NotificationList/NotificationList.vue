<!--
  通知列表组件
  显示分享通知列表，支持标记为已读和跳转到分享页面
-->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { shareNotificationService } from '@/application/share/share-notification-service'
import type { ShareNotification } from '@/application/share/share-notification-service'
import { LucideIcon, EmptyState, SkeletonList } from '@/components'
import { logger } from '@/infrastructure/logging/logger'

defineOptions({
  name: 'NotificationList'
})

// 从服务获取状态
const notifications = computed(() => shareNotificationService.notifications.value)
const isLoading = computed(() => shareNotificationService.isLoading.value)
const error = computed(() => shareNotificationService.error.value)

/**
 * 格式化时间（相对时间）
 */
function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric'
  })
}

/**
 * 处理通知点击
 */
function handleNotificationClick(notification: ShareNotification): void {
  logger.info('NotificationList', '通知被点击', { notificationId: notification.id })
  shareNotificationService.openNotification(notification)
}

/**
 * 标记为已读
 */
async function handleMarkAsRead(notification: ShareNotification, event: Event): Promise<void> {
  event.stopPropagation()
  try {
    await shareNotificationService.markAsRead(notification.id)
  } catch (err) {
    logger.error('NotificationList', '标记已读失败', err)
  }
}

// 组件挂载时加载通知
onMounted(() => {
  shareNotificationService.fetchNotifications({ unreadOnly: false, limit: 20 })
})
</script>

<template>
  <div class="notification-list">
    <!-- Loading 状态 - 使用骨架屏 -->
    <div v-if="isLoading" class="notification-list__loading">
      <SkeletonList
        :count="5"
        :show-avatar="true"
        :show-secondary="true"
        :show-actions="true"
        animation="pulse"
      />
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="notification-list__error">
      <EmptyState icon="alert-circle" title="加载失败" :description="error" :show-action="false" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="notifications.length === 0" class="notification-list__empty">
      <EmptyState
        icon="inbox"
        title="暂无通知"
        description="你还没有收到任何通知"
        :show-action="false"
      />
    </div>

    <!-- 通知列表 -->
    <div v-else class="notification-list__items">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="notification-item"
        :class="{ 'notification-item--unread': !notification.read }"
        @click="handleNotificationClick(notification)"
      >
        <!-- 未读指示器 -->
        <div v-if="!notification.read" class="notification-item__indicator"></div>

        <!-- 发送者头像 -->
        <div class="notification-item__avatar">
          <LucideIcon name="user-circle" :size="40" />
        </div>

        <!-- 通知内容 -->
        <div class="notification-item__content">
          <div class="notification-item__header">
            <span class="notification-item__title">{{ notification.title }}</span>
            <span class="notification-item__time">{{ formatTime(notification.created_at) }}</span>
          </div>
          <p class="notification-item__message">{{ notification.message }}</p>
        </div>

        <!-- 操作按钮 -->
        <div class="notification-item__actions">
          <md-icon-button
            v-if="!notification.read"
            class="notification-item__action"
            :style="{ '--md-icon-button-icon-size': '18px' }"
            title="标记为已读"
            @click="handleMarkAsRead(notification, $event)"
          >
            <LucideIcon name="check" :size="18" />
          </md-icon-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notification-list {
  display: flex;
  flex-direction: column;
  width: 100%; /* ✅ 改为 100%，由父容器控制宽度 */
  min-width: 260px;
  max-height: 500px;
  border-radius: var(--radius-md);
  background: var(--color-surface);
  overflow: hidden auto;
  box-shadow: var(--shadow-lg);
}

.notification-list__loading {
  padding: var(--spacing-3);
}

.notification-list__error,
.notification-list__empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-6);
  text-align: center;
}

.notification-list__items {
  display: flex;
  flex-direction: column;
}

.notification-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  border-bottom: 1px solid var(--color-border-subtle);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.notification-item:hover {
  background: var(--color-surface-container-low);
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item--unread {
  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));
}

.notification-item--unread:hover {
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
}

.notification-item__indicator {
  position: absolute;
  top: var(--spacing-3);
  left: var(--spacing-2);
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
}

.notification-item__avatar {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  background: var(--color-surface-container);
}

.notification-item__content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--spacing-1);
  min-width: 0;
}

.notification-item__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-2);
}

.notification-item__title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.notification-item__time {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.notification-item__message {
  display: -webkit-box;
  margin: 0;
  font-size: var(--text-sm);
  line-height: var(--line-height-normal);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.notification-item__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.notification-item:hover .notification-item__actions {
  opacity: 1;
}

.notification-item__action {
  color: var(--color-text-secondary);
  transition: color var(--transition-fast);
}

.notification-item__action:hover {
  color: var(--color-primary);
}
</style>
