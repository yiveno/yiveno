<script setup lang="ts">
import { computed } from 'vue'

import {
  getMaterialSymbolPath,
  getMaterialSymbolViewBox,
  type MaterialSymbolName
} from '@/infrastructure/ui/icons/material-symbol'

defineOptions({ name: 'MaterialSymbolIcon' })

const props = withDefaults(
  defineProps<{
    name: MaterialSymbolName
    /** 边长，默认跟随 md-icon-button 槽位。 */
    size?: string
  }>(),
  {
    size: '24px'
  }
)

const pathD = computed(() => getMaterialSymbolPath(props.name))
const viewBox = computed(() => getMaterialSymbolViewBox(props.name))
</script>

<template>
  <svg
    class="material-symbol-icon"
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="viewBox"
    :width="size"
    :height="size"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="pathD" />
  </svg>
</template>

<style scoped>
.material-symbol-icon {
  display: block;
  flex-shrink: 0;
  fill: currentColor;
}
</style>
