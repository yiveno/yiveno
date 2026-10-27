<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  subscribeSoftToast,
  type SoftToastItem,
  type SoftToastTone
} from '../composables/use-soft-toast'

defineOptions({ name: 'SoftToastHost' })

const items = ref<SoftToastItem[]>([])
/** 避免 Astro/SSR Teleport 水合不匹配：仅客户端挂载浮层 */
const mounted = ref(false)
let unsubscribe: (() => void) | null = null

onMounted(() => {
  mounted.value = true
  unsubscribe = subscribeSoftToast(next => {
    items.value = next
  })
})

onBeforeUnmount(() => {
  unsubscribe?.()
  unsubscribe = null
})

const markByTone: Record<SoftToastTone, string> = {
  info: 'i',
  success: '✓',
  warning: '!',
  error: '!'
}
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <div class="soft-toast-host">
      <div
        v-for="item in items"
        :key="item.id"
        class="soft-toast"
        :class="`soft-toast--${item.tone}`"
        :role="item.tone === 'error' ? 'alert' : 'status'"
        :aria-live="item.tone === 'error' ? 'assertive' : 'polite'"
      >
        <span class="soft-toast__mark" aria-hidden="true">{{ markByTone[item.tone] }}</span>
        <p class="soft-toast__message">{{ item.message }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.soft-toast-host {
  position: fixed;
  z-index: 60;
  top: max(1rem, env(safe-area-inset-top));
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: max-content;
  max-width: min(26rem, calc(100vw - 2rem));
  transform: translateX(-50%);
  pointer-events: none;
}

.soft-toast {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.5rem;
  box-sizing: border-box;
  width: fit-content;
  max-width: 100%;
  padding: 0.65rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 10px);
  background: var(--surface-raised, var(--surface));
  box-shadow: 0 8px 24px color-mix(in srgb, var(--ink) 12%, transparent);
  animation: soft-toast-enter 220ms ease-out;
}

.soft-toast__mark {
  flex-shrink: 0;
  width: 1.15rem;
  height: 1.15rem;
  margin-top: 0.1rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.15rem;
  text-align: center;
  color: var(--surface);
  background: var(--muted);
}

.soft-toast--info .soft-toast__mark {
  background: var(--accent, #3d6b5a);
}

.soft-toast--success .soft-toast__mark {
  background: var(--sage, #4a6b5a);
}

.soft-toast--warning .soft-toast__mark {
  background: color-mix(in srgb, #b45309 85%, black);
}

.soft-toast--error .soft-toast__mark {
  background: var(--danger, #b42318);
}

.soft-toast__message {
  flex: 0 1 auto;
  min-width: 0;
  margin: 0;
  color: var(--on-surface, var(--ink));
  font-size: 0.875rem;
  font-weight: 300;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

@keyframes soft-toast-enter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .soft-toast {
    animation: none;
  }
}
</style>
