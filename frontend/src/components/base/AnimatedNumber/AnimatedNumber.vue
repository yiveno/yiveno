<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { AnimatedNumberProps } from './AnimatedNumber.d'

const props = withDefaults(defineProps<AnimatedNumberProps>(), {
  duration: 600
})

const display = ref(0)
let raf: number | null = null
let startTime = 0
let startValue = 0

const animateTo = (target: number) => {
  if (raf !== null) {
    cancelAnimationFrame(raf)
    raf = null
  }

  startTime = performance.now()
  startValue = display.value
  const delta = target - startValue

  const tick = () => {
    const progress = Math.min(1, (performance.now() - startTime) / props.duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    display.value = Math.round(startValue + delta * eased)
    if (progress < 1) {
      raf = requestAnimationFrame(tick)
    }
  }

  raf = requestAnimationFrame(tick)
}

onMounted(() => animateTo(props.value))

watch(
  () => props.value,
  newValue => {
    animateTo(newValue)
  }
)
</script>

<template>
  <span>{{ display }}</span>
</template>
