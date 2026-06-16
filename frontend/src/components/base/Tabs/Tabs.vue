<script setup lang="ts">
import type { TabsProps, TabsEmits } from './Tabs.d'

defineOptions({
  name: 'MdTabs'
})

withDefaults(defineProps<TabsProps>(), {
  modelValue: 0
})

const emit = defineEmits<TabsEmits>()

const handleChange = (event: Event) => {
  const target = event.target as HTMLElement & { activeTabIndex: number }
  emit('update:modelValue', target.activeTabIndex)
  emit('change', event)
}
</script>

<template>
  <md-tabs :active-tab-index="modelValue" @change="handleChange">
    <slot />
  </md-tabs>
</template>
