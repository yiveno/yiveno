<script setup lang="ts">
import { computed, ref } from 'vue'
import { Avatar, LucideIcon } from '@/components'
import { useSupabaseAuth, useSubscription } from '@/composables'
import { emitEvent } from '@/infrastructure/events/event-bus'
import { logger } from '@/infrastructure/logging/logger'
import { websiteUrls, openWebsiteUrl } from '@/config/website'

defineOptions({ name: 'UserMenu' })

const { size = 30 } = defineProps<UserMenuProps>()

interface UserMenuProps {
  /** 头像尺寸 */
  size?: number
}

const { user, isAuthenticated, signOut } = useSupabaseAuth()
const { isPro, subscriptionStatus } = useSubscription()

const isLoggedIn = computed(() => isAuthenticated.value)
const isLoggingOut = ref(false)
const showMenu = ref(false)
const menuRef = ref<HTMLElement | null>(null)

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

/** 点击按钮：切换菜单显示/隐藏 */
function handleClick(event: MouseEvent) {
  event.stopPropagation()
  
  // 🔥 未登录：直接跳转登录页，不显示下拉菜单
  if (!isLoggedIn.value) {
    handleLogin()
    return
  }
  
  // 切换菜单显示状态
  showMenu.value = !showMenu.value
}

/** 菜单打开事件 */
function handleMenuOpened() {
  logger.debug('UserMenu', '菜单已打开')
}

/** 菜单关闭事件 */
function handleMenuClosed() {
  showMenu.value = false
  logger.debug('UserMenu', '菜单已关闭')
}

/** 登录 */
async function handleLogin() {
  try {
    showMenu.value = false
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
    showMenu.value = false
  } catch (error) {
    logger.error('UserMenu', '退出登录失败', error)
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="user-menu">
    <md-icon-button
      id="user-menu-anchor"
      :class="avatarWrapperClasses"
      :title="avatarTitle"
      :style="{ '--md-icon-button-icon-size': `${size}px` }"
      @click="handleClick"
    >
      <!-- 未登录：显示图标 -->
      <LucideIcon v-if="!isLoggedIn" name="user" :size="size * 0.8" />
      
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
        <LucideIcon name="crown" :size="10" />
      </div>
    </md-icon-button>
  </div>

  <!-- Material Design 3 Menu -->
  <md-menu
    id="user-menu"
    ref="menuRef"
    anchor="user-menu-anchor"
    :open="showMenu"
    :quick="true"
    @opened="handleMenuOpened"
    @closed="handleMenuClosed"
  >
    <!-- 未登录菜单 -->
    <template v-if="!isLoggedIn">
      <md-menu-item @click="handleLogin">
        <LucideIcon slot="start" name="log-in" :size="16" />
        立即登录
      </md-menu-item>
    </template>

    <!-- 已登录菜单 -->
    <template v-else>
      <!-- 用户信息头部 -->
      <div class="user-menu__header">
        <LucideIcon name="user" :size="16" class="user-menu__header-icon" />
        <span class="user-menu__header-title">{{ displayName }}</span>
      </div>
      
      <!-- 订阅信息 -->
      <div class="user-menu__info">
        <div class="user-menu__info-row">
          <LucideIcon :name="isPro ? 'crown' : 'circle'" :size="14" />
          <span>{{ isPro ? 'PRO 方案' : 'FREE 方案' }}</span>
        </div>
        <div v-if="isPro && expiryDate" class="user-menu__info-row">
          <LucideIcon name="calendar" :size="14" />
          <span>到期：{{ expiryDate }}</span>
        </div>
      </div>
      
      <md-divider></md-divider>
      
      <!-- 退出登录 -->
      <md-menu-item
        class="user-menu__logout-item"
        :disabled="isLoggingOut"
        @click="handleLogout"
      >
        <LucideIcon slot="start" name="log-out" :size="16" />
        {{ isLoggingOut ? '退出中...' : '退出登录' }}
      </md-menu-item>
    </template>
  </md-menu>
</template>

<style scoped>
/* 组件样式 */
.user-menu {
  position: relative;
  display: inline-flex;
}

.user-menu__avatar-wrapper {
  position: relative;
  padding: 0;
  color: var(--color-text-secondary);
  transition: color var(--md-sys-motion-duration-short2);
}

/* 未登录：与 ThemeToggle 保持一致的样式 */
.user-menu__avatar-wrapper--guest {
  color: var(--color-text-secondary);
}

.user-menu__avatar-wrapper--guest:hover {
  color: var(--color-primary);
}

/* 免费用户：头像外层容器添加边框 */
.user-menu__avatar-wrapper--free .user-menu__avatar {
  border: 2px solid var(--md-sys-color-primary);
}

.user-menu__avatar-wrapper--free:hover .user-menu__avatar {
  box-shadow: 0 2px 8px color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent);
}

/* PRO 用户：头像外层容器添加金色边框 + 光晕 */
.user-menu__avatar-wrapper--pro .user-menu__avatar {
  border: 2px solid var(--acuity-accent-gold);
  box-shadow: 0 0 12px color-mix(in srgb, var(--acuity-accent-gold) 40%, transparent);
}

.user-menu__avatar-wrapper--pro:hover .user-menu__avatar {
  box-shadow: 0 0 16px color-mix(in srgb, var(--acuity-accent-gold) 60%, transparent);
}

/* 头像 */
.user-menu__avatar {
  border-radius: var(--radius-full);
}

/* PRO 徽章（右下角小皇冠，与官网一致） */
.user-menu__badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  color: var(--md-sys-color-on-primary);
  background: linear-gradient(135deg, var(--color-warning) 0%, var(--color-warning-dark) 100%);
  box-shadow: var(--shadow-sm);
}

/* Material Design 3 Menu 样式 */
md-menu {
  --md-menu-container-color: var(--md-sys-color-surface-container);
  --md-menu-container-shape: var(--radius-lg);
  --md-menu-container-elevation: 2;

  min-width: 220px;
}

/* 用户信息头部 */
.user-menu__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.user-menu__header-icon {
  color: var(--color-text-secondary);
}

.user-menu__header-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

/* 订阅信息 */
.user-menu__info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
}

.user-menu__info-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

md-menu-item {
  --md-menu-item-label-text-color: var(--md-sys-color-on-surface);
  --md-menu-item-label-text-font: var(--font-family-base);
  --md-menu-item-label-text-size: var(--text-sm);
  --md-menu-item-one-line-container-height: 48px;
}

/* 退出登录按钮（危险操作） */
.user-menu__logout-item {
  --md-menu-item-label-text-color: var(--md-sys-color-error);
}

.user-menu__logout-item :deep(svg) {
  color: var(--md-sys-color-error);
}

/* Material Web Divider 样式 */
md-divider {
  margin: var(--spacing-2) 0;
}
</style>
