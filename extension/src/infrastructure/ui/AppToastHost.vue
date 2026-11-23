<script setup lang="ts">
import AppToast from '@/infrastructure/ui/AppToast.vue'
import { useAppToast } from '@/infrastructure/ui/use-app-toast'

defineOptions({ name: 'AppToastHost' })

const props = withDefaults(
  defineProps<{
    /** 相对视口顶部的 CSS 长度；默认 var(--space-md)。Side Panel 可抬到顶栏下方。 */
    topOffset?: string
  }>(),
  {
    topOffset: 'var(--space-md)'
  }
)

const { toasts } = useAppToast()
</script>

<template>
  <Teleport to="body">
    <div
      class="app-toast-host"
      :style="{ top: props.topOffset }"
      aria-live="polite"
      aria-relevant="additions"
    >
      <AppToast
        v-for="item in toasts"
        :id="item.id"
        :key="item.id"
        :tone="item.tone"
        :message="item.message"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.app-toast-host {
  position: fixed;
  right: 0;
  left: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  max-width: none;
  pointer-events: none;
}
</style>
