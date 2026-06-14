<script setup lang="ts">
import { computed } from 'vue'
import type { SwitchProps, SwitchEmits } from './Switch.d'

defineOptions({
  name: 'MdSwitch'
})

const props = withDefaults(defineProps<SwitchProps>(), {
  modelValue: false,
  disabled: false,
  required: false,
  showOnlySelectedIcon: false
})

const emit = defineEmits<SwitchEmits>()

const handleChange = (event: Event) => {
  const target = event.target as HTMLInputElement & { selected: boolean }
  emit('update:modelValue', target.selected)
  emit('change', event)
}

const handleInput = (event: InputEvent) => {
  emit('input', event)
}

const switchAttrs = computed(() => ({
  selected: props.modelValue,
  disabled: props.disabled,
  required: props.required,
  showOnlySelectedIcon: props.showOnlySelectedIcon,
  icons: true as const,
  ...(props.value !== undefined ? { value: props.value } : {})
}))
</script>

<template>
  <md-switch
    v-bind="switchAttrs"
    @change="handleChange"
    @input="handleInput"
  />
</template>
