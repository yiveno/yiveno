<script setup lang="ts">
import { message } from '@/application/message/message-service'

defineOptions({
  name: 'Message'
})

const messages = message.messages
const config = message.config
</script>

<template>
  <Teleport to="body">
    <div class="message-container" :style="{ top: `${config.top}px` }">
      <TransitionGroup name="v-fade-offset">
        <div
          v-for="item in messages"
          :key="item.id"
          :class="['message', `message--${item.type}`]"
          role="alert"
          :aria-live="item.type === 'error' ? 'assertive' : 'polite'"
        >
          <!-- 图标 -->
          <div v-if="item.showIcon" class="message-icon">
            <svg
              v-if="item.type === 'success'"
              class="message-icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <svg
              v-else-if="item.type === 'error'"
              class="message-icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <svg
              v-else-if="item.type === 'warning'"
              class="message-icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <svg
              v-else-if="item.type === 'info'"
              class="message-icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <md-circular-progress
              v-else-if="item.type === 'loading'"
              indeterminate
              class="message-icon-progress size-xs"
            />
          </div>

          <!-- 消息内容 -->
          <span class="message-content">{{ item.content }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.message-container {
  position: fixed;
  left: 50%;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2);
  pointer-events: none;
  transform: translateX(-50%);
}

/* ============================================
   Message 项
   ============================================ */
.message {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  max-width: 560px;
  min-height: 40px;
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--md-sys-shape-corner-small);
  font-size: var(--md-sys-typescale-body-medium-size);
  line-height: var(--md-sys-typescale-body-medium-line-height);
  color: var(--md-sys-color-on-surface);
  background: var(--md-sys-color-surface-container-high);
  pointer-events: auto;
  box-shadow: var(--md-sys-elevation-3);
  overflow-wrap: break-word;
}

/* ============================================
   图标
   ============================================ */
.message-icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
}

.message-icon-svg {
  width: 100%;
  height: 100%;
}

.message-icon-progress {
  --md-circular-progress-active-indicator-color: var(--md-sys-color-primary);
}

/* ============================================
   消息内容
   ============================================ */
.message-content {
  flex: 1;
}

/* ============================================
   类型样式
   ============================================ */
.message--success {
  color: var(--md-sys-color-on-primary-container);
  background: var(--md-sys-color-primary-container);
}

.message--success .message-icon {
  color: var(--md-sys-color-primary);
}

.message--error {
  color: var(--md-sys-color-on-error-container);
  background: var(--md-sys-color-error-container);
}

.message--error .message-icon {
  color: var(--md-sys-color-error);
}

.message--warning {
  color: var(--md-sys-color-on-tertiary-container);
  background: var(--md-sys-color-tertiary-container);
}

.message--warning .message-icon {
  color: var(--md-sys-color-tertiary);
}

.message--info {
  color: var(--md-sys-color-on-secondary-container);
  background: var(--md-sys-color-secondary-container);
}

.message--info .message-icon {
  color: var(--md-sys-color-secondary);
}

.message--loading {
  color: var(--md-sys-color-on-surface);
  background: var(--md-sys-color-surface-container-high);
}

.message--loading .message-icon {
  color: var(--md-sys-color-primary);
}
</style>
