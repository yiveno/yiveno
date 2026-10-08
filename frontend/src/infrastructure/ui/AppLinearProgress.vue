<script setup lang="ts">
/**
 * 自研线性进度条；value 为 0–1，缺省为不确定动画。
 */
defineOptions({ name: 'AppLinearProgress' })

defineProps<{
  /** 0–1；不传则 indeterminate */
  value?: number
  ariaLabel?: string
}>()
</script>

<template>
  <div
    class="app-linear-progress"
    role="progressbar"
    :aria-label="ariaLabel"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuenow="value === undefined ? undefined : Math.round(value * 100)"
  >
    <div
      class="app-linear-progress__bar"
      :class="{ 'app-linear-progress__bar--indeterminate': value === undefined }"
      :style="
        value === undefined ? undefined : { width: `${Math.min(100, Math.max(0, value * 100))}%` }
      "
    />
  </div>
</template>

<style scoped>
.app-linear-progress {
  width: 100%;
  height: 4px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
  overflow: hidden;
}

.app-linear-progress__bar {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width var(--motion-duration-short) var(--motion-easing-standard);
}

.app-linear-progress__bar--indeterminate {
  width: 40%;
  animation: app-linear-indeterminate 1.2s var(--motion-easing-standard) infinite;
}

@keyframes app-linear-indeterminate {
  0% {
    width: 30%;
    margin-left: 0;
  }

  50% {
    width: 40%;
    margin-left: 40%;
  }

  100% {
    width: 20%;
    margin-left: 100%;
  }
}
</style>
