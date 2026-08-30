<script setup lang="ts">
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import type { AppIconName } from '@/infrastructure/ui/icons/icon-paths'
import type { AppToastTone } from '@/infrastructure/ui/use-app-toast'

defineOptions({ name: 'AppToast' })

const props = defineProps<{
  tone: AppToastTone
  message: string
}>()

const iconByTone: Record<AppToastTone, AppIconName> = {
  info: 'info',
  success: 'check_circle',
  warning: 'triangle_alert',
  error: 'circle_alert'
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
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  box-shadow: var(--shadow-ink-sm);
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
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--on-surface);
  word-break: break-word;
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
