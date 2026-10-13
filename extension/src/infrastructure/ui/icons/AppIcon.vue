<script setup lang="ts">
import { computed } from 'vue'

import {
  getAppIconNodes,
  getAppIconViewBox,
  type AppIconName
} from '@/infrastructure/ui/icons/icon-paths'

defineOptions({ name: 'AppIcon' })

const props = withDefaults(
  defineProps<{
    name: AppIconName
    /** 边长，默认 24px；数字按 px。 */
    size?: string | number
  }>(),
  {
    size: '24px'
  }
)

const resolvedSize = computed(() =>
  typeof props.size === 'number' ? `${props.size}px` : props.size
)

const nodes = computed(() => getAppIconNodes(props.name))
const viewBox = computed(() => getAppIconViewBox(props.name))
</script>

<template>
  <svg
    class="app-icon"
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="viewBox"
    :width="resolvedSize"
    :height="resolvedSize"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <component :is="tag" v-for="([tag, attrs], index) in nodes" :key="index" v-bind="attrs" />
  </svg>
</template>

<style scoped>
.app-icon {
  display: block;
  flex-shrink: 0;
}
</style>
