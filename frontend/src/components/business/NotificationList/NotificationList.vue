<!--
  通知列表组件
  显示分享通知列表，支持标记为已读和跳转到分享页面
-->
<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { inboxNotification } from '@/application/inbox-notification/inbox-notification-service'
import type { InboxNotification } from '@/application/inbox-notification/inbox-notification-service'
import { LucideIcon, EmptyState, SkeletonList } from '@/components'
import { logger } from '@/infrastructure/logging/logger'

defineOptions({
  name: 'NotificationList'
})

// 从服务获取状态
const notifications = computed(() => inboxNotification.notifications.value)
const isLoading = computed(() => inboxNotification.isLoading.value)
const error = computed(() => inboxNotification.error.value)

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
 * Gmail 风格：点击未读通知时自动标记为已读
 */
async function handleNotificationClick(notification: InboxNotification): Promise<void> {
  logger.info('NotificationList', '通知被点击', {
    notificationId: notification.id
  })

  // 如果是未读通知，先标记为已读
  if (!notification.is_read) {
    try {
      await inboxNotification.markAsRead(notification.id)
    } catch (err) {
      logger.error('NotificationList', '标记已读失败', err)
    }
  }

  // 打开通知详情
  inboxNotification.openNotification(notification)
}

// 组件挂载时加载通知
onMounted(() => {
  void inboxNotification.fetchNotifications({ unreadOnly: false, limit: 20 })
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
        :class="{
          'surface-interactive': notification.is_read,
          'notification-item--unread': !notification.is_read
        }"
        @click="handleNotificationClick(notification)"
      >
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.notification-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 320px;
  max-height: 470px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  overflow: hidden auto;
  box-shadow: var(--shadow-xl);
}

.notification-list__loading {
  padding: var(--spacing-2);
}

.notification-list__error,
.notification-list__empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-8);
  text-align: center;
}

.notification-list__items {
  display: flex;
  flex-direction: column;
}

.notification-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  min-height: 64px;
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid var(--color-border-subtle);
  cursor: pointer;
}

.notification-item:active {
  opacity: 0.8;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item--unread {
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
}

.notification-item--unread:hover {
  background: color-mix(in srgb, var(--color-primary) 16%, var(--color-surface));
}

.notification-item--unread::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: var(--color-primary);
  content: '';
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
  transition: all var(--transition-fast);
}

.notification-item:hover .notification-item__avatar {
  background: var(--color-surface-container-high);
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
  align-items: baseline;
  gap: var(--spacing-2);
}

.notification-item__title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  line-height: var(--line-height-tight);
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-item--unread .notification-item__title {
  font-weight: var(--font-bold);
}

.notification-item__time {
  flex-shrink: 0;
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--color-text-tertiary);
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

/* 滚动条样式 */
.notification-list::-webkit-scrollbar {
  width: 6px;
}

.notification-list::-webkit-scrollbar-track {
  background: transparent;
}

.notification-list::-webkit-scrollbar-thumb {
  border-radius: var(--radius-full);
  background: var(--color-surface-container-high);
}

.notification-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-surface-container-highest);
}
</style>
