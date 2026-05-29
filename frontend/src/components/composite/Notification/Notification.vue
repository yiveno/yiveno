<script setup lang="ts">
import { reactive } from "vue";
import LucideIcon from "@/components/base/LucideIcon/LucideIcon.vue";

type NotificationType = "success" | "info" | "warning" | "error";
type NotificationPlacement =
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

interface NotificationItem {
  id: string;
  key?: string | undefined;
  type: NotificationType;
  message?: string | undefined;
  description?: string | undefined;
  duration?: number | undefined;
  closable?: boolean | undefined;
  icon?: boolean | undefined;
  placement: NotificationPlacement;
  createdAt: number;
  paused: boolean;
  pausedAt?: number | undefined; // 暂停时的时间戳
  remainingTime?: number | undefined; // 暂停时的剩余时间（秒）
  timer?: ReturnType<typeof setTimeout> | undefined;
  progressStartTime?: number | undefined; // 进度条开始时间
  progressKey?: number | undefined; // 进度条 key，用于强制重新渲染
}

interface NotificationConfig {
  key?: string | undefined;
  message?: string | undefined;
  description?: string | undefined;
  duration?: number | undefined;
  closable?: boolean | undefined;
  icon?: boolean | undefined;
  placement?: NotificationPlacement | undefined;
}

const state = reactive<{
  notifications: NotificationItem[];
  defaultPlacement: NotificationPlacement;
  defaultDuration: number;
}>({
  notifications: [],
  defaultPlacement: "topRight",
  defaultDuration: 4.5,
});

const placements: NotificationPlacement[] = [
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
];

function getNotificationsByPlacement(placement: NotificationPlacement) {
  return state.notifications.filter((n) => n.placement === placement);
}

function getIconName(type: NotificationType): string {
  const iconMap: Record<NotificationType, string> = {
    success: "check-circle",
    info: "info",
    warning: "alert-triangle",
    error: "x-circle",
  };
  return iconMap[type];
}

function generateId(): string {
  return `notification_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function open(config: NotificationConfig & { type: NotificationType }) {
  const {
    key,
    type,
    message,
    description,
    duration,
    closable,
    icon,
    placement,
  } = config;

  // 🎯 Ant Design 核心特性：通过 key 判断是更新还是新建
  if (key) {
    const existing = state.notifications.find((n) => n.key === key);
    if (existing) {
      // 更新现有通知
      existing.type = type;
      existing.message = message;
      existing.description = description;
      existing.duration = duration ?? state.defaultDuration;
      existing.closable = closable ?? true;
      existing.icon = icon ?? true;
      existing.paused = false;

      // 清除旧定时器
      if (existing.timer) {
        clearTimeout(existing.timer);
      }

      // 重新设置定时器
      if (existing.duration > 0) {
        existing.timer = setTimeout(() => {
          close(existing.id);
        }, existing.duration * 1000);
      }

      return;
    }
  }

  // 创建新通知
  const id = generateId();
  const item: NotificationItem = {
    id,
    key,
    type,
    message,
    description,
    duration: duration ?? state.defaultDuration,
    closable: closable ?? true,
    icon: icon ?? true,
    placement: placement ?? state.defaultPlacement,
    createdAt: Date.now(),
    paused: false,
    progressStartTime: Date.now(),
    progressKey: Date.now(),
  };

  state.notifications.push(item);

  // 自动关闭
  if (item.duration && item.duration > 0) {
    item.timer = setTimeout(() => {
      close(id);
    }, item.duration * 1000);
  }
}

function close(id: string) {
  const index = state.notifications.findIndex((n) => n.id === id);
  if (index === -1) return;

  const item = state.notifications[index];
  if (!item) return;

  // 清除定时器
  if (item.timer) {
    clearTimeout(item.timer);
  }

  // 移除通知
  state.notifications.splice(index, 1);
}

function destroy(key?: string) {
  if (key) {
    const item = state.notifications.find((n) => n.key === key);
    if (item) {
      close(item.id);
    }
  } else {
    // 清除所有通知
    state.notifications.forEach((n) => {
      if (n.timer) {
        clearTimeout(n.timer);
      }
    });
    state.notifications = [];
  }
}

function handleMouseEnter(id: string) {
  const item = state.notifications.find((n) => n.id === id);
  if (!item || !item.duration) return;

  item.paused = true;
  item.pausedAt = Date.now();

  // 计算并保存剩余时间
  const elapsed = (Date.now() - item.createdAt) / 1000;
  item.remainingTime = Math.max(0, item.duration - elapsed);

  if (item.timer) {
    clearTimeout(item.timer);
    item.timer = undefined;
  }
}

function handleMouseLeave(id: string) {
  const item = state.notifications.find((n) => n.id === id);
  if (!item || !item.duration) return;

  item.paused = false;

  // 使用暂停时记录的剩余时间
  const remaining = item.remainingTime ?? item.duration;

  if (remaining > 0) {
    // ✅ 更新 progressKey 强制重新渲染进度条，使用剩余时间重新开始动画
    // 这样动画时长和定时器时长保持一致
    item.progressKey = Date.now();

    // 重启定时器（使用相同的剩余时间）
    item.timer = setTimeout(() => {
      close(item.id);
    }, remaining * 1000);
  } else {
    close(item.id);
    item.pausedAt = undefined;
    item.remainingTime = undefined;
  }
}

// 获取进度条样式（纯 CSS 动画驱动）
function getProgressStyle(item: NotificationItem) {
  if (!item.duration || item.duration <= 0) return {};

  // ✅ 如果有剩余时间（恢复后），使用剩余时间作为动画时长
  // 这样动画时长和定时器时长保持一致
  const duration = item.remainingTime ?? item.duration;

  return {
    animationDuration: `${duration}s`,
  };
}

// 导出方法供外部调用
defineExpose({
  open,
  success: (config: NotificationConfig) => open({ ...config, type: "success" }),
  error: (config: NotificationConfig) => open({ ...config, type: "error" }),
  info: (config: NotificationConfig) => open({ ...config, type: "info" }),
  warning: (config: NotificationConfig) => open({ ...config, type: "warning" }),
  destroy,
  config: (cfg: { placement?: NotificationPlacement; duration?: number }) => {
    if (cfg.placement) state.defaultPlacement = cfg.placement;
    if (cfg.duration !== undefined) state.defaultDuration = cfg.duration;
  },
});
</script>

<template>
  <teleport to="body">
    <div
      v-for="placement in placements"
      :key="placement"
      :class="['ab-notification-container', `ab-notification-${placement}`]"
    >
      <transition-group name="ab-notification" tag="div">
        <div
          v-for="item in getNotificationsByPlacement(placement)"
          :key="item.key || item.id"
          class="ab-notification"
          :class="[`ab-notification-${item.type}`]"
          @mouseenter="handleMouseEnter(item.id)"
          @mouseleave="handleMouseLeave(item.id)"
        >
          <!-- 进度条：使用纯 CSS 动画，零 JS 开销 -->
          <div
            v-if="item.duration && item.duration > 0"
            class="ab-notification-progress-wrapper"
          >
            <div
              :key="item.progressKey"
              class="ab-notification-progress-bar"
              :class="[
                `ab-notification-progress-bar--${item.type}`,
                { 'ab-notification-progress-bar--paused': item.paused },
              ]"
              :style="getProgressStyle(item)"
            ></div>
          </div>
          <div class="ab-notification-content">
            <div v-if="item.icon !== false" class="ab-notification-icon">
              <LucideIcon :name="getIconName(item.type)" :size="24" />
            </div>
            <div class="ab-notification-message">
              <div v-if="item.message" class="ab-notification-title">
                {{ item.message }}
              </div>
              <div v-if="item.description" class="ab-notification-description">
                {{ item.description }}
              </div>
            </div>
            <md-icon-button
              v-if="item.closable !== false"
              class="ab-notification-close"
              :style="{ '--md-icon-button-icon-size': '14px' }"
              :aria-label="`关闭${item.message}通知`"
              @click="close(item.id)"
            >
              <LucideIcon name="x" :size="14" />
            </md-icon-button>
          </div>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<style scoped>
@keyframes notification-slide-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes notification-slide-out {
  0% {
    opacity: 1;
    transform: translateX(0);
  }

  50% {
    opacity: 0;
    transform: translateX(100%);
  }

  100% {
    max-height: 0;
    margin-bottom: 0;
    padding-top: 0;
    padding-bottom: 0;
    opacity: 0;
    transform: translateX(100%);
  }
}

/* 进度条动画 */
@keyframes progress-countdown {
  from {
    width: 100%;
  }

  to {
    width: 0%;
  }
}

.ab-notification-container {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
}

.ab-notification-container > div {
  pointer-events: none;
}

.ab-notification {
  position: relative;
  width: 384px;
  max-width: calc(100vw - 32px);
  margin-bottom: var(--spacing-4);
  padding: var(--spacing-4) var(--spacing-6);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  pointer-events: auto;
  overflow: hidden;
  box-shadow:
    0 10px 15px -3px var(--color-shadow-010),
    0 4px 6px -2px var(--color-shadow-005),
    0 0 1px var(--color-shadow-010);
}

/* 进度条容器 */
.ab-notification-progress-wrapper {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: var(--color-shadow-005);
  overflow: hidden;
}

/* 进度条 */
.ab-notification-progress-bar {
  width: 100%;
  height: 100%;
  transition: width 0.1s ease-out;
  animation: progress-countdown linear forwards;
}

/* 暂停状态 */
.ab-notification-progress-bar--paused {
  animation-play-state: paused;
}

/* 颜色 */
.ab-notification-success .ab-notification-progress-bar {
  background: var(--color-success);
}

.ab-notification-info .ab-notification-progress-bar {
  background: var(--color-info);
}

.ab-notification-warning .ab-notification-progress-bar {
  background: var(--color-warning);
}

.ab-notification-error .ab-notification-progress-bar {
  background: var(--color-error);
}

.ab-notification-topLeft,
.ab-notification-topRight {
  top: var(--spacing-6);
}

.ab-notification-bottomLeft,
.ab-notification-bottomRight {
  bottom: var(--spacing-6);
}

.ab-notification-topLeft,
.ab-notification-bottomLeft {
  left: var(--spacing-6);
}

.ab-notification-topRight,
.ab-notification-bottomRight {
  right: var(--spacing-6);
}

.ab-notification-content {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-3);
}

.ab-notification-icon {
  flex-shrink: 0;
  line-height: 1;
}

.ab-notification-success .ab-notification-icon {
  color: var(--color-success);
}

.ab-notification-info .ab-notification-icon {
  color: var(--color-info);
}

.ab-notification-warning .ab-notification-icon {
  color: var(--color-warning);
}

.ab-notification-error .ab-notification-icon {
  color: var(--color-error);
}

.ab-notification-message {
  flex: 1;
  min-width: 0;
}

.ab-notification-title {
  margin-bottom: var(--spacing-2);
  font-size: var(--text-base);
  font-weight: 600;
  line-height: 24px;
  color: var(--color-text-primary);
}

.ab-notification-description {
  font-size: var(--text-sm);
  line-height: 22px;
  color: var(--color-text-secondary);
}

.ab-notification-close {
  flex-shrink: 0;
  padding: 0;
  border: none;
  outline: none;
  line-height: 1;
  color: var(--color-text-tertiary);
  background: none;
  cursor: pointer;
  transition: color var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

.ab-notification-close:hover {
  color: var(--color-text-primary);
}

/* 动画 */
.ab-notification-enter-active {
  animation: notification-slide-in var(--md-sys-motion-duration-medium1)
    var(--md-sys-motion-easing-emphasized);
}

.ab-notification-leave-active {
  animation: notification-slide-out var(--md-sys-motion-duration-medium1)
    var(--md-sys-motion-easing-emphasized);
}
</style>
