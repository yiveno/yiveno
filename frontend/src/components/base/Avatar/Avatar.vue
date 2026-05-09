<template>
  <div :class="avatarClasses" :style="avatarStyle">
    <!-- 优先显示图片 -->
    <img
      v-if="src"
      :src="src"
      :alt="alt"
      class="avatar__image"
      @error="handleImageError"
    />
    <!-- 图片加载失败或无图片时显示文字或图标 -->
    <LucideIcon
      v-else-if="!text"
      name="user"
      :size="size * 0.5"
      class="avatar__icon"
    />
    <span v-else class="avatar__text">{{ displayText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { LucideIcon } from '@/components'

defineOptions({ name: 'AcuityAvatar' })

interface AvatarProps {
  /** 头像图片 URL */
  src?: string
  /** 头像文字（图片加载失败时显示，如果为 undefined 则显示图标） */
  text?: string
  /** 头像尺寸（像素） */
  size?: number
  /** 头像形状 */
  variant?: 'circle' | 'square'
  /** 图片 alt 文本 */
  alt?: string
}

const props = withDefaults(defineProps<AvatarProps>(), {
  src: undefined,
  text: undefined,
  size: 40,
  variant: 'circle',
  alt: '用户头像'
})

// 图片加载失败标记
const imageError = ref(false)

// 处理图片加载失败
const handleImageError = () => {
  imageError.value = true
}

// 显示的文字（图片加载失败或无图片时）
const displayText = computed(() => {
  if (props.text) {
    // 如果是多个字符，只取第一个
    return props.text.charAt(0).toUpperCase()
  }
  return '?'
})

// 头像样式类
const avatarClasses = computed(() => [
  'avatar',
  `avatar--${props.variant}`,
  {
    'avatar--image': props.src && !imageError.value,
    'avatar--text': (!props.src || imageError.value) && props.text,
    'avatar--icon': (!props.src || imageError.value) && !props.text
  }
])

// 头像动态样式
const avatarStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${props.size * 0.4}px` // 文字大小为头像尺寸的 40%
}))
</script>

<style scoped>
.avatar {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  background: var(--md-sys-color-surface-container-high);
  user-select: none;
  transition: all var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
  overflow: hidden;
  box-shadow: 0 1px 3px rgb(0 0 0 / 12%), 0 1px 2px rgb(0 0 0 / 8%);
}

.avatar--circle {
  border-radius: var(--radius-full);
}

.avatar--square {
  border-radius: var(--radius-md);
}

.avatar__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar__text {
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-on-surface-variant);
}

.avatar__icon {
  color: var(--md-sys-color-on-surface-variant);
}

/* 图片头像：无背景色 */
.avatar--image {
  background: transparent;
}

/* 文字头像：使用主题色背景 */
.avatar--text {
  background: var(--md-sys-color-primary-container);
}

.avatar--text .avatar__text {
  color: var(--md-sys-color-on-primary-container);
}

/* 图标头像：使用灰色背景 */
.avatar--icon {
  background: var(--md-sys-color-surface-container-high);
}

.avatar--icon .avatar__icon {
  color: var(--md-sys-color-on-surface-variant);
}
</style>
