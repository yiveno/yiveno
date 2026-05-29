<script setup lang="ts">
import { computed, ref } from 'vue'
import { LucideIcon } from '@/components'
import type { AvatarProps } from './Avatar.d'

const props = withDefaults(defineProps<AvatarProps>(), {
  size: 40,
  variant: 'circle'
})

const imageError = ref(false)

const avatarClasses = computed(() => ['acuity-avatar', `acuity-avatar--${props.variant}`])

const avatarStyle = computed(() => ({
  width: typeof props.size === 'number' ? `${props.size}px` : props.size,
  height: typeof props.size === 'number' ? `${props.size}px` : props.size,
  fontSize: typeof props.size === 'number' ? `${props.size * 0.4}px` : undefined
}))

const iconSize = computed(() => {
  if (typeof props.size === 'number') {
    return Math.round(props.size * 0.6)
  }
  return 16
})

const initials = computed(() => {
  if (!props.text) return ''
  return props.text
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .substring(0, 2)
    .toUpperCase()
})

const handleImageError = () => {
  imageError.value = true
}
</script>

<template>
  <div :class="avatarClasses">
    <img v-if="src" :src="src" :alt="alt" class="acuity-avatar-img" @error="handleImageError" />
    <LucideIcon v-else-if="icon" :name="icon" :size="iconSize" />
    <span v-else class="acuity-avatar-text">{{ initials }}</span>
  </div>
</template>

<style scoped>
.acuity-avatar {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: v-bind('avatarStyle.width');
  height: v-bind('avatarStyle.height');
  font-size: v-bind('avatarStyle.fontSize');
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  background: var(--color-surface-variant);
  overflow: hidden;
}

.acuity-avatar--circle {
  border-radius: 50%;
}

.acuity-avatar--rounded {
  border-radius: var(--radius-md);
}

.acuity-avatar--square {
  border-radius: 0;
}

.acuity-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.acuity-avatar-text {
  line-height: 1;
}
</style>
