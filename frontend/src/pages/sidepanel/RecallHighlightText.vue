<script setup lang="ts">
import type { RecallHighlightPart } from '@/core/recall/highlight-recall-text'

defineOptions({ name: 'RecallHighlightText' })

defineProps<{
  parts: RecallHighlightPart[]
}>()
</script>

<template>
  <template v-for="(part, index) in parts">
    <mark v-if="part.hit" :key="`h-${index}`" class="recall-hit">{{ part.text }}</mark>
    <span v-else :key="`t-${index}`">{{ part.text }}</span>
  </template>
</template>

<style scoped>
.recall-hit {
  padding: 0 1px;
  border-radius: var(--radius-xs);
  font-weight: 650;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
</style>
