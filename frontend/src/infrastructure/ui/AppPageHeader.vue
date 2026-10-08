<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { SUBSCRIPTION_SNAPSHOT_STORAGE_KEY } from '@/core/identity/subscription-snapshot'
import { watchAuthSessionStorage } from '@/infrastructure/auth/watch-auth-session-storage'
import { openExtensionLibraryPage } from '@/infrastructure/browser/library-page'
import { openExtensionOptionsPage } from '@/infrastructure/browser/options-page'
import { openWebsiteAccountPage } from '@/infrastructure/browser/website-page'
import { t } from '@/infrastructure/i18n/t'
import {
  authSignIn,
  fetchAuthState,
  fetchSubscriptionStatus,
  refreshAuthProfile
} from '@/infrastructure/messaging/background-client'
import AppIconButton from '@/infrastructure/ui/AppIconButton.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'

defineOptions({ name: 'AppPageHeader' })

const props = withDefaults(
  defineProps<{
    /** 当前页面对应导航项；该入口不展示，避免自跳。 */
    current?: 'library' | 'settings' | 'none'
    /** Side Panel：展示「新找一轮」入口（图标 + title/aria）。 */
    showNewFind?: boolean
    /** 有活动线程时可点；空壳时禁用。 */
    newFindEnabled?: boolean
    /**
     * 是否展示右侧导航（账号 / 记忆库 / 设置 / DEV）。
     * Getting Started 等首跑激活页可关，避免首屏 chrome 抢注意力。
     */
    showNav?: boolean
  }>(),
  {
    current: 'none',
    showNewFind: false,
    newFindEnabled: false,
    showNav: true
  }
)

const emit = defineEmits<{
  /** 打开记忆库或设置失败时通知父级。 */
  navigateError: [message: string]
  /** 用户显式开新找回线程。 */
  newFind: []
}>()

const signedIn = ref(false)
const avatarUrl = ref('')
const accountLabel = ref('')
const accountBusy = ref(false)
/** 头像图加载失败时回退图标，避免裂图。 */
const avatarBroken = ref(false)
/** 有效 Pro：头像 1px Sage 环（档位区分，非会员虚荣装饰）。 */
const isPro = ref(false)

const showLibrary = computed(() => props.current !== 'library')
const showSettings = computed(() => props.current !== 'settings')
/** DEV-only：测试工作台入口；生产构建为 false，按钮不渲染。 */
const showProbeConsole = import.meta.env.DEV

const showAvatarImage = computed(
  () => signedIn.value && Boolean(avatarUrl.value) && !avatarBroken.value
)

/** 已登录且 Pro 时显示档位环（含无图回退图标）。 */
const showProRing = computed(() => signedIn.value && isPro.value)

/** 扩展包内 logo mark（构建后位于 dist/images/）。 */
const brandLogoUrl = chrome.runtime.getURL('images/logo-mark.svg')

const accountTitle = computed(() => {
  if (!signedIn.value) {
    return t('nav_sign_in')
  }
  const parts = [t('nav_account')]
  if (accountLabel.value) {
    parts.push(accountLabel.value)
  }
  if (isPro.value) {
    parts.push(t('settings_subscription_tier_pro'))
  }
  return parts.join(' · ')
})

async function refreshProChip(): Promise<void> {
  try {
    const response = await fetchSubscriptionStatus()
    isPro.value = response.ok && response.snapshot.isPro
  } catch {
    isPro.value = false
  }
}

async function refreshAuthChip() {
  try {
    const response = await fetchAuthState()
    // 读失败勿当未登录：否则 absorb/IDB 瞬时错误会把已登录头像打成访客图标
    if (!response.ok) {
      return
    }
    signedIn.value = response.signedIn
    avatarUrl.value = response.avatarUrl?.trim() ?? ''
    accountLabel.value = response.displayName?.trim() || response.email?.trim() || ''
    avatarBroken.value = false

    if (!response.signedIn) {
      isPro.value = false
      return
    }

    // 已登录但本地无头像：补拉一次 getUser（旧 session / refresh 冲掉后的自愈）
    if (!avatarUrl.value) {
      const refreshed = await refreshAuthProfile()
      if (refreshed.ok && refreshed.avatarUrl?.trim()) {
        avatarUrl.value = refreshed.avatarUrl.trim()
        accountLabel.value =
          refreshed.displayName?.trim() || refreshed.email?.trim() || accountLabel.value
        avatarBroken.value = false
      }
    }

    void refreshProChip()
  } catch {
    signedIn.value = false
    avatarUrl.value = ''
    accountLabel.value = ''
    avatarBroken.value = false
    isPro.value = false
  }
}

async function handleOpenLibrary() {
  try {
    await openExtensionLibraryPage()
  } catch {
    emit('navigateError', t('error_open_library'))
  }
}

async function handleOpenSettings() {
  try {
    await openExtensionOptionsPage()
  } catch {
    emit('navigateError', t('error_open_settings'))
  }
}

/** 打开 DEV 测试工作台；动态 import，避免生产包静态依赖 src/dev。 */
async function handleOpenProbeConsole() {
  if (!import.meta.env.DEV) {
    return
  }
  try {
    const { openProbeConsolePage } = await import('@/dev/probe-console/open-probe-console-page')
    await openProbeConsolePage()
  } catch {
    emit('navigateError', 'Could not open the DEV test workbench.')
  }
}

async function handleOpenAccount() {
  if (accountBusy.value) {
    return
  }
  accountBusy.value = true
  try {
    if (signedIn.value) {
      await openWebsiteAccountPage()
      return
    }
    const response = await authSignIn()
    if (!response.ok) {
      emit('navigateError', t('settings_error_auth_sign_in'))
    }
  } catch {
    emit(
      'navigateError',
      signedIn.value ? t('error_open_account') : t('settings_error_auth_sign_in')
    )
  } finally {
    accountBusy.value = false
  }
}

function handleNewFind() {
  if (!props.newFindEnabled) {
    return
  }
  emit('newFind')
}

function handleSubscriptionStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  if (areaName !== 'local' || !(SUBSCRIPTION_SNAPSHOT_STORAGE_KEY in changes)) {
    return
  }
  void refreshProChip()
}

/** 取消登录态 / 订阅快照订阅。 */
let stopWatchAuthSession: (() => void) | null = null

onMounted(() => {
  void refreshAuthChip()
  stopWatchAuthSession = watchAuthSessionStorage(() => {
    void refreshAuthChip()
  })
  chrome.storage.onChanged.addListener(handleSubscriptionStorageChanged)
})

onUnmounted(() => {
  stopWatchAuthSession?.()
  stopWatchAuthSession = null
  chrome.storage.onChanged.removeListener(handleSubscriptionStorageChanged)
})
</script>

<template>
  <div class="app-page-header">
    <div class="app-page-header__brand-row">
      <img
        class="app-page-header__logo"
        :src="brandLogoUrl"
        alt=""
        width="20"
        height="20"
        decoding="async"
      />
      <p class="app-page-header__brand">{{ t('app_name') }}</p>
    </div>
    <nav v-if="showNav" class="app-page-header__nav" :aria-label="t('nav_aria_label')">
      <AppIconButton
        v-if="showNewFind"
        :title="t('nav_new_find')"
        :aria-label="t('nav_new_find')"
        :disabled="!newFindEnabled"
        @click="handleNewFind"
      >
        <AppIcon name="message_circle_plus" size="22px" />
      </AppIconButton>
      <AppIconButton
        :title="accountTitle"
        :aria-label="accountTitle"
        :disabled="accountBusy"
        @click="handleOpenAccount"
      >
        <span
          class="app-page-header__avatar-wrap"
          :class="{ 'app-page-header__avatar-wrap--pro': showProRing }"
        >
          <img
            v-if="showAvatarImage"
            class="app-page-header__avatar"
            :src="avatarUrl"
            alt=""
            width="22"
            height="22"
            referrerpolicy="no-referrer"
            @error="avatarBroken = true"
          />
          <AppIcon v-else name="account_circle" size="22px" />
        </span>
      </AppIconButton>
      <AppIconButton
        v-if="showLibrary"
        :title="t('nav_library')"
        :aria-label="t('nav_library')"
        @click="handleOpenLibrary"
      >
        <AppIcon name="library_books" size="22px" />
      </AppIconButton>
      <AppIconButton
        v-if="showSettings"
        :title="t('nav_settings')"
        :aria-label="t('nav_settings')"
        @click="handleOpenSettings"
      >
        <AppIcon name="settings" size="22px" />
      </AppIconButton>
      <AppIconButton
        v-if="showProbeConsole"
        title="Test workbench (DEV)"
        aria-label="Test workbench (DEV)"
        @click="handleOpenProbeConsole"
      >
        <AppIcon name="package" size="22px" />
      </AppIconButton>
    </nav>
  </div>
</template>

<style scoped>
.app-page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  max-width: 100%;
}

.app-page-header__brand-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.app-page-header__logo {
  display: block;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.app-page-header__brand {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--on-surface-muted);
}

.app-page-header__nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
}

.app-page-header__avatar-wrap {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  border-radius: 50%;
  line-height: 0;
}

/* 1px Sage 环：仅 Pro；无 glow / 无加粗描边 */
.app-page-header__avatar-wrap--pro {
  box-shadow: 0 0 0 1px var(--accent);
}

.app-page-header__avatar {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
}
</style>
