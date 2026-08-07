<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { AUTH_SESSION_STORAGE_KEY } from '@/core/identity/auth-session'
import { openExtensionLibraryPage } from '@/infrastructure/browser/library-page'
import { openExtensionOptionsPage } from '@/infrastructure/browser/options-page'
import { openWebsiteAccountPage } from '@/infrastructure/browser/website-page'
import { t } from '@/infrastructure/i18n/t'
import {
  authSignIn,
  fetchAuthState,
  refreshAuthProfile
} from '@/infrastructure/messaging/background-client'
import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'

defineOptions({ name: 'AppPageHeader' })

const props = withDefaults(
  defineProps<{
    /** 当前页面对应导航项；该入口不展示，避免自跳。 */
    current?: 'library' | 'settings' | 'none'
  }>(),
  {
    current: 'none'
  }
)

const emit = defineEmits<{
  /** 打开记忆库或设置失败时通知父级。 */
  navigateError: [message: string]
}>()

const signedIn = ref(false)
const avatarUrl = ref('')
const accountLabel = ref('')
const accountBusy = ref(false)
/** 头像图加载失败时回退图标，避免裂图。 */
const avatarBroken = ref(false)

const showLibrary = computed(() => props.current !== 'library')
const showSettings = computed(() => props.current !== 'settings')

const showAvatarImage = computed(
  () => signedIn.value && Boolean(avatarUrl.value) && !avatarBroken.value
)

/** 扩展包内 logo mark（构建后位于 dist/images/）。 */
const brandLogoUrl = chrome.runtime.getURL('images/logo-mark.svg')

const accountTitle = computed(() => {
  if (!signedIn.value) {
    return t('nav_sign_in')
  }
  if (accountLabel.value) {
    return `${t('nav_account')} · ${accountLabel.value}`
  }
  return t('nav_account')
})

async function refreshAuthChip() {
  try {
    const response = await fetchAuthState()
    if (!response.ok) {
      signedIn.value = false
      avatarUrl.value = ''
      accountLabel.value = ''
      avatarBroken.value = false
      return
    }
    signedIn.value = response.signedIn
    avatarUrl.value = response.avatarUrl?.trim() ?? ''
    accountLabel.value = response.displayName?.trim() || response.email?.trim() || ''
    avatarBroken.value = false

    // 已登录但本地无头像：补拉一次 getUser（旧 session / refresh 冲掉后的自愈）
    if (response.signedIn && !avatarUrl.value) {
      const refreshed = await refreshAuthProfile()
      if (refreshed.ok && refreshed.avatarUrl?.trim()) {
        avatarUrl.value = refreshed.avatarUrl.trim()
        accountLabel.value =
          refreshed.displayName?.trim() || refreshed.email?.trim() || accountLabel.value
        avatarBroken.value = false
      }
    }
  } catch {
    signedIn.value = false
    avatarUrl.value = ''
    accountLabel.value = ''
    avatarBroken.value = false
  }
}

function handleOpenLibrary() {
  try {
    openExtensionLibraryPage()
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

function handleStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
) {
  if (areaName !== 'local' || !(AUTH_SESSION_STORAGE_KEY in changes)) {
    return
  }
  void refreshAuthChip()
}

onMounted(() => {
  void refreshAuthChip()
  chrome.storage.onChanged.addListener(handleStorageChanged)
})

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(handleStorageChanged)
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
    <nav class="app-page-header__nav" :aria-label="t('nav_aria_label')">
      <md-icon-button
        type="button"
        :title="accountTitle"
        :aria-label="accountTitle"
        :disabled="accountBusy"
        @click="handleOpenAccount"
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
        <MaterialSymbolIcon v-else name="account_circle" size="22px" />
      </md-icon-button>
      <md-icon-button
        v-if="showLibrary"
        type="button"
        :title="t('nav_library')"
        :aria-label="t('nav_library')"
        @click="handleOpenLibrary"
      >
        <MaterialSymbolIcon name="library_books" size="22px" />
      </md-icon-button>
      <md-icon-button
        v-if="showSettings"
        type="button"
        :title="t('nav_settings')"
        :aria-label="t('nav_settings')"
        @click="handleOpenSettings"
      >
        <MaterialSymbolIcon name="settings" size="22px" />
      </md-icon-button>
    </nav>
  </div>
</template>

<style scoped>
.app-page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-width: 0;
  max-width: 100%;
}

.app-page-header__brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
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
  color: var(--md-sys-color-on-surface-variant);
}

.app-page-header__nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
}

.app-page-header__avatar {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
}
</style>
