<script setup lang="ts">
import type { RecallHighlightPart } from '@/core/recall/highlight-recall-text'

defineOptions({ name: 'RecallHighlightText' })

defineProps<{
  parts: RecallHighlightPart[]
}>()
</script>

<template>
  <template v-for="(part, index) in parts" :key="index">
    <mark v-if="part.hit" class="recall-hit">{{ part.text }}</mark>
    <template v-else>{{ part.text }}</template>
  </template>
</template>

<style scoped>
.recall-hit {
  padding: 0 1px;
  color: var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 18%, transparent);
  border-radius: 2px;
  font-weight: 650;
}
</style>
