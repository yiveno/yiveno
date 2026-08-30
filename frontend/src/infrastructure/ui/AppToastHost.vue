<script setup lang="ts">
import AppToast from '@/infrastructure/ui/AppToast.vue'
import { useAppToast } from '@/infrastructure/ui/use-app-toast'

defineOptions({ name: 'AppToastHost' })

const { toasts } = useAppToast()
</script>

<template>
  <Teleport to="body">
    <div class="app-toast-host" aria-live="polite" aria-relevant="additions">
      <AppToast v-for="item in toasts" :key="item.id" :tone="item.tone" :message="item.message" />
    </div>
  </Teleport>
</template>

<style scoped>
.app-toast-host {
  position: fixed;
  top: var(--space-md);
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
