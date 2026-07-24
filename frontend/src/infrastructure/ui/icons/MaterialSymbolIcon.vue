<script setup lang="ts">
import {
  getMaterialSymbolPath,
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

const pathD = getMaterialSymbolPath(props.name)
</script>

<template>
  <svg
    class="material-symbol-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
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
