<template>
  <!-- 头像始终显示 -->
  <div
    class="user-menu"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div :class="avatarWrapperClasses" :title="avatarTitle">
      <!-- 未登录：显示图标 -->
      <div v-if="!isLoggedIn" class="user-menu__guest-icon" :style="{ width: `${size}px`, height: `${size}px` }">
        <LucideIcon name="user" :size="size * 0.8" />
      </div>
      
      <!-- 已登录：显示头像 -->
      <Avatar
        v-else
        :src="avatarUrl"
        :text="avatarInitial"
        :size="size"
        variant="circle"
        class="user-menu__avatar"
      />
      
      <!-- PRO 徽章（右下角小皇冠） -->
      <div v-if="isPro" class="user-menu__badge">
        <LucideIcon name="crown" :size="12" />
      </div>
    </div>
  </div>

  <!-- 下拉菜单 -->
  <Teleport to="body">
    <div
      v-if="showContextMenu"
      ref="contextMenuRef"
      class="user-menu__dropdown"
      :style="contextMenuStyle"
      @mouseenter="handleMenuMouseEnter"
      @mouseleave="handleMenuMouseLeave"
    >
      <!-- 未登录菜单 -->
      <template v-if="!isLoggedIn">
        <button class="user-menu__dropdown-item" @click="handleLogin">
          <LucideIcon name="log-in" :size="16" />
          <span>立即登录</span>
        </button>
      </template>

      <!-- 已登录菜单 -->
      <template v-else>
        <div class="user-menu__dropdown-header">
          <LucideIcon name="user" :size="16" class="user-menu__dropdown-icon" />
          <span class="user-menu__dropdown-title">{{ displayName }}</span>
        </div>
        <div class="user-menu__dropdown-info">
          <div class="user-menu__dropdown-row">
            <LucideIcon :name="isPro ? 'crown' : 'circle'" :size="14" />
            <span>{{ isPro ? 'PRO 方案' : 'FREE 方案' }}</span>
          </div>
          <div v-if="isPro && expiryDate" class="user-menu__dropdown-row">
            <LucideIcon name="calendar" :size="14" />
            <span>到期：{{ expiryDate }}</span>
          </div>
        </div>
        <Divider />
        <button class="user-menu__dropdown-item user-menu__dropdown-item--danger" :disabled="isLoggingOut" @click="handleLogout">
          <LucideIcon name="log-out" :size="16" />
          <span>{{ isLoggingOut ? '退出中...' : '退出登录' }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Avatar, LucideIcon, Divider } from '@/components'
import { useSupabaseAuth, useSubscription } from '@/composables'
import { emitEvent } from '@/infrastructure/events/event-bus'
import { logger } from '@/infrastructure/logging/logger'
import { websiteUrls, openWebsiteUrl } from '@/config/website'

defineOptions({ name: 'UserMenu' })

interface UserMenuProps {
  /** 头像尺寸 */
  size?: number
}

const { size = 32 } = defineProps<UserMenuProps>()

const { user, isAuthenticated, signOut } = useSupabaseAuth()
const { isPro, subscriptionStatus } = useSubscription()

// 🐛 调试日志
console.log('[UserMenu] 组件初始化:', {
  isAuthenticated: isAuthenticated.value,
  user: user.value,
  isPro: isPro.value
})

const isLoggedIn = computed(() => isAuthenticated.value)
const isLoggingOut = ref(false)
const showContextMenu = ref(false)
const contextMenuRef = ref<HTMLElement | null>(null)
const contextMenuPosition = ref({ x: 0, y: 0 })
const hoverTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

/** 用户邮箱 */
const userEmail = computed(() => user.value?.email ?? '')

/** 显示名称：full_name > name > 邮箱前缀 */
const displayName = computed(() => {
  if (!user.value) return '未登录'
  const meta = user.value.user_metadata
  return (
    meta?.full_name ||
    meta?.name ||
    user.value.email?.split('@')[0] ||
    '用户'
  )
})

/** 头像 URL */
const avatarUrl = computed(() => {
  if (!user.value) return undefined
  const meta = user.value.user_metadata
  return meta?.avatar_url || meta?.picture || meta?.avatar || meta?.photo || undefined
})

/** 头像首字母（仅登录时使用） */
const avatarInitial = computed(() => {
  if (!isLoggedIn.value) {
    return undefined // 未登录时不显示文字
  }
  if (displayName.value && displayName.value !== '未登录') {
    return displayName.value.charAt(0).toUpperCase()
  }
  if (userEmail.value) return userEmail.value.charAt(0).toUpperCase()
  return '?'
})

/** 头像容器样式类 */
const avatarWrapperClasses = computed(() => [
  'user-menu__avatar-wrapper',
  {
    'user-menu__avatar-wrapper--guest': !isLoggedIn.value,
    'user-menu__avatar-wrapper--free': isLoggedIn.value && !isPro.value,
    'user-menu__avatar-wrapper--pro': isLoggedIn.value && isPro.value
  }
])

/** 头像 title */
const avatarTitle = computed(() => {
  if (!isLoggedIn.value) return '登录 / 注册'
  if (isPro.value) return '账户中心 (PRO)'
  return '账户中心 (FREE)'
})

/** 到期日期（格式化） */
const expiryDate = computed(() => {
  if (!subscriptionStatus.value?.current_period_end) return null
  const date = new Date(subscriptionStatus.value.current_period_end)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
})

/** 右键菜单样式 */
const contextMenuStyle = computed(() => ({
  left: `${contextMenuPosition.value.x}px`,
  top: `${contextMenuPosition.value.y}px`
}))

/** 左键点击：切换菜单显示/隐藏 */
function handleClick(event: MouseEvent) {
  event.stopPropagation()
  
  // 🔥 未登录：直接跳转登录页，不显示下拉菜单
  if (!isLoggedIn.value) {
    handleLogin()
    return
  }
  
  const target = event.currentTarget as HTMLElement | null
  if (!target) {
    console.warn('[UserMenu] event.currentTarget is null')
    return
  }
  
  // 如果菜单已显示，关闭它
  if (showContextMenu.value) {
    closeContextMenu()
  } else {
    // 否则显示菜单
    const rect = target.getBoundingClientRect()
    showMenuAtPosition(rect.left, rect.bottom + 8)
  }
}

/** 鼠标悬停：延迟显示菜单 */
function handleMouseEnter(event: MouseEvent) {
  // 🔥 未登录：不显示下拉菜单
  if (!isLoggedIn.value) {
    return
  }
  
  // 清除之前的定时器
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
  }
  
  // 立即获取目标元素的位置（在事件处理时获取，避免 setTimeout 后 currentTarget 变为 null）
  const target = event.currentTarget as HTMLElement | null
  if (!target) {
    console.warn('[UserMenu] event.currentTarget is null')
    return
  }
  
  const rect = target.getBoundingClientRect()
  
  // 延迟 200ms 显示菜单（缩短延迟，更快响应）
  hoverTimeout.value = setTimeout(() => {
    // 菜单显示在头像下方
    showMenuAtPosition(rect.left, rect.bottom + 8)
  }, 200)
}

/** 鼠标离开头像：延迟关闭菜单 */
function handleMouseLeave() {
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
    hoverTimeout.value = null
  }
  
  // 延迟 300ms 关闭菜单，给用户时间移动到菜单上
  hoverTimeout.value = setTimeout(() => {
    closeContextMenu()
  }, 300)
}

/** 鼠标进入菜单：取消关闭 */
function handleMenuMouseEnter() {
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
    hoverTimeout.value = null
  }
}

/** 鼠标离开菜单：关闭菜单 */
function handleMenuMouseLeave() {
  closeContextMenu()
}

/** 在指定位置显示菜单 */
function showMenuAtPosition(x: number, y: number) {
  // 计算菜单位置（避免超出屏幕）
  const menuWidth = 240
  const menuHeight = isLoggedIn.value ? 180 : 140
  
  // 防止菜单超出右边界
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }
  
  // 防止菜单超出下边界
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }
  
  contextMenuPosition.value = { x, y }
  showContextMenu.value = true
}

/** 关闭右键菜单 */
function closeContextMenu() {
  showContextMenu.value = false
}

/** 登录 */
async function handleLogin() {
  try {
    closeContextMenu()
    await openWebsiteUrl(websiteUrls.login)
  } catch (error) {
    logger.error('UserMenu', '打开登录页失败', error)
  }
}

/** 退出登录 */
async function handleLogout() {
  if (isLoggingOut.value) return
  try {
    isLoggingOut.value = true
    await signOut()
    emitEvent('auth:logged-out', {})
    closeContextMenu()
  } catch (error) {
    logger.error('UserMenu', '退出登录失败', error)
  } finally {
    isLoggingOut.value = false
  }
}

/** 点击外部关闭菜单 */
function handleClickOutside(event: MouseEvent) {
  if (
    showContextMenu.value &&
    contextMenuRef.value &&
    !contextMenuRef.value.contains(event.target as Node)
  ) {
    closeContextMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  // 清理定时器
  if (hoverTimeout.value) {
    clearTimeout(hoverTimeout.value)
  }
})
</script>

<style scoped>
/* 动画定义 */
@keyframes dropdown-fade-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 组件样式 */
.user-menu {
  position: relative;
  display: inline-flex;
  cursor: pointer;
}

.user-menu__avatar-wrapper {
  position: relative;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 2px;
  border-radius: var(--radius-full);
  transition: all var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

/* 未登录图标容器 */
.user-menu__guest-icon {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  background: var(--md-sys-color-surface-container);
}

/* 未登录：灰色边框 */
.user-menu__avatar-wrapper--guest {
  border: 2px solid var(--color-text-secondary);
  opacity: 0.7;
}

.user-menu__avatar-wrapper--guest:hover {
  opacity: 1;
  box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
}

/* 免费用户：蓝绿色边框（与官网一致） */
.user-menu__avatar-wrapper--free {
  border: 2px solid var(--md-sys-color-primary);
}

.user-menu__avatar-wrapper--free:hover {
  box-shadow: 0 2px 8px color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent);
}

/* PRO 用户：金色边框 + 光晕 */
.user-menu__avatar-wrapper--pro {
  /* ✅ 使用 design-tokens 的 accent-gold 颜色 */
  border: 2px solid var(--acuity-accent-gold);
  box-shadow: 0 0 12px color-mix(in srgb, var(--acuity-accent-gold) 40%, transparent);
}

.user-menu__avatar-wrapper--pro:hover {
  box-shadow: 0 0 16px color-mix(in srgb, var(--acuity-accent-gold) 60%, transparent);
}

/* 头像 */
.user-menu__avatar {
  border-radius: var(--radius-full);
}

/* PRO 徽章（右下角小皇冠，与官网一致） */
.user-menu__badge {
  position: absolute;
  right: -4px;
  bottom: -4px;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  color: #fff;

  /* ✅ 使用 design-tokens 的 accent-gold 和 accent-amber 颜色 */
  background: linear-gradient(135deg, var(--acuity-accent-gold) 0%, var(--acuity-accent-amber) 100%);
  box-shadow: 0 2px 4px rgb(0 0 0 / 20%);
}

/* 下拉菜单 */
.user-menu__dropdown {
  position: fixed;
  z-index: 9999;
  min-width: 220px;
  padding: var(--spacing-2) 0;
  border-radius: var(--radius-lg);
  background: var(--md-sys-color-surface-container);
  box-shadow: 0 8px 24px rgb(0 0 0 / 20%), 0 2px 8px rgb(0 0 0 / 10%);
  backdrop-filter: blur(10px);
  animation: dropdown-fade-in var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

/* 菜单头部 */
.user-menu__dropdown-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
}

.user-menu__dropdown-icon {
  color: var(--color-text-secondary);
}

.user-menu__dropdown-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

/* 提示文字 */
.user-menu__dropdown-hint {
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

/* 信息区域 */
.user-menu__dropdown-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-4);
}

.user-menu__dropdown-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

/* 菜单项 */
.user-menu__dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  width: 100%;
  padding: var(--spacing-2) var(--spacing-4);
  border: none;
  font-size: var(--text-sm);
  text-align: left;
  color: var(--color-text-primary);
  background: transparent;
  cursor: pointer;
  transition: background var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.user-menu__dropdown-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.user-menu__dropdown-item:hover:not(:disabled) {
  background: var(--color-surface-hover);
}

.user-menu__dropdown-item--danger {
  color: var(--md-sys-color-error);
}

/* 头像容器 */
</style>
