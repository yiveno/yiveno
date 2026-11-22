<script setup lang="ts">
defineOptions({ name: 'DetailExportBarDock' })

defineProps<{
  /** 是否展示底栏（离场时先播动画再卸载） */
  visible: boolean
}>()
</script>

<template>
  <Transition name="detail-export-bar-dock">
    <div v-if="visible" class="detail-export-bar-dock">
      <slot />
    </div>
  </Transition>
</template>

<style scoped>
.detail-export-bar-dock {
  /* 禁止被父 flex 压矮裁切；稳态可见以免裁向上格式菜单 */
  flex-shrink: 0;
  width: 100%;
  overflow: visible;
}

.detail-export-bar-dock-enter-active {
  transition:
    transform var(--motion-duration-medium) var(--motion-easing-emphasized),
    opacity var(--motion-duration-medium) var(--motion-easing-standard);
}

.detail-export-bar-dock-leave-active {
  transition:
    transform var(--motion-duration-medium) cubic-bezier(0.4, 0, 0.2, 1),
    opacity var(--motion-duration-short) cubic-bezier(0.4, 0, 0.2, 1);
}

.detail-export-bar-dock-enter-from,
.detail-export-bar-dock-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.detail-export-bar-dock-enter-to,
.detail-export-bar-dock-leave-from {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .detail-export-bar-dock-enter-active,
  .detail-export-bar-dock-leave-active {
    transition: opacity var(--motion-duration-short) var(--motion-easing-standard);
  }

  .detail-export-bar-dock-enter-from,
  .detail-export-bar-dock-leave-to {
    transform: none;
  }
}
</style>
