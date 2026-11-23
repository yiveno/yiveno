<script setup lang="ts">
import { t } from '@/infrastructure/i18n/t'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import type { AppIconName } from '@/infrastructure/ui/icons/icon-paths'
import { dismissToast, type AppToastTone } from '@/infrastructure/ui/use-app-toast'

defineOptions({ name: 'AppToast' })

const props = defineProps<{
  id: number
  tone: AppToastTone
  message: string
}>()

const iconByTone: Record<AppToastTone, AppIconName> = {
  info: 'info',
  success: 'check_circle',
  warning: 'triangle_alert',
  error: 'circle_alert'
}

function handleDismiss(): void {
  dismissToast(props.id)
}
</script>

<template>
  <div
    class="app-toast"
    :class="`app-toast--${props.tone}`"
    role="status"
    :aria-live="props.tone === 'error' ? 'assertive' : 'polite'"
  >
    <AppIcon class="app-toast__icon" :name="iconByTone[props.tone]" size="18px" />
    <p class="app-toast__message">{{ props.message }}</p>
    <button
      type="button"
      class="app-toast__dismiss"
      :aria-label="t('app_toast_dismiss')"
      @click="handleDismiss"
    >
      <AppIcon name="close" size="16px" />
    </button>
  </div>
</template>

<style scoped>
.app-toast {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  box-sizing: border-box;
  width: fit-content;
  max-width: min(420px, calc(100vw - var(--space-lg) * 2));
  padding: var(--space-sm) var(--space-sm) var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  box-shadow: var(--shadow-ink-sm);
  pointer-events: auto;
  animation: app-toast-enter var(--motion-duration-medium) var(--motion-easing-emphasized);
}

.app-toast__icon {
  flex-shrink: 0;
}

.app-toast--info .app-toast__icon {
  color: var(--yiveno-semantic-info);
}

.app-toast--success .app-toast__icon {
  color: var(--yiveno-semantic-success);
}

.app-toast--warning .app-toast__icon {
  color: var(--yiveno-semantic-warning);
}

.app-toast--error .app-toast__icon {
  color: var(--yiveno-semantic-error);
}

.app-toast__message {
  flex: 0 1 auto;
  min-width: 0;
  margin: 0;
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
  color: var(--on-surface);
  overflow-wrap: anywhere;
}

/* ghost 小关闭：不抢语气色，仅 hover 提对比 */
.app-toast__dismiss {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  color: var(--on-surface-muted);
  background: transparent;
  cursor: pointer;
  transition:
    background-color var(--motion-duration-fast) var(--motion-easing-standard),
    color var(--motion-duration-fast) var(--motion-easing-standard);
}

.app-toast__dismiss:hover {
  color: var(--on-surface);
  background: color-mix(
    in srgb,
    var(--on-surface) calc(var(--state-hover-opacity) * 100%),
    transparent
  );
}

.app-toast__dismiss:active {
  background: color-mix(
    in srgb,
    var(--on-surface) calc(var(--state-pressed-opacity) * 100%),
    transparent
  );
}

.app-toast__dismiss:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

@keyframes app-toast-enter {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}
</style>
