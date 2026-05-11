<template>
  <div v-if="isAuthenticated" class="settings-section">
    <h3 class="section-subtitle">
      <LucideIcon name="user" />
      <span>{{ t('settings_account_title') }}</span>
    </h3>
    <div class="grid">
      <!-- 用户头像 -->
      <div class="row">
        <div class="label">{{ t('settings_account_avatar') }}</div>
        <div class="field">
          <Avatar
            :src="avatarUrl"
            :text="avatarInitial"
            :size="64"
            variant="circle"
          />
        </div>
      </div>

      <!-- 账号/邮箱 -->
      <div class="row">
        <div class="label">{{ t('settings_account_email') }}</div>
        <div class="field">
          <div class="email-with-provider">
            <span class="email">{{
              userEmail || t('settings_account_email_not_set')
            }}</span>
            <Badge
              v-if="loginProvider"
              :color="loginProviderColor"
              variant="filled"
              size="sm"
              class="provider-badge"
            >
              <span class="provider-icon-text">{{
                loginProviderIconText
              }}</span>
              {{ loginProviderName }}
            </Badge>
          </div>
        </div>
      </div>

      <!-- 昵称（只读，来自 OAuth） -->
      <div class="row">
        <div class="label">{{ t('settings_account_nickname') }}</div>
        <div class="field">
          <span class="nickname-text">{{
            nickname || t('settings_account_nickname_placeholder')
          }}</span>
        </div>
      </div>

      <!-- 当前计划 -->
      <div class="row">
        <div class="label">{{ t('settings_account_plan') }}</div>
        <div class="field">
          <Badge
            :color="subscriptionTier === 'pro' ? 'primary' : 'secondary'"
            variant="filled"
            size="sm"
          >
            {{ subscriptionTier === 'pro' ? 'PRO' : 'FREE' }}
          </Badge>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="row">
        <div class="label"></div>
        <div class="field btn-row">
          <Button
            size="md"
            color="error"
            variant="outline"
            :loading="isLoggingOut"
            @click="logout"
          >
            <template #prepend><LucideIcon name="log-out" /></template>
            {{ t('settings_account_logout') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref
} from 'vue'

defineOptions({
  name: 'AccountSettings'
})
import { Avatar, Badge, Button } from '@/components'
import { t } from '@/utils/i18n-helpers'
import { useSupabaseAuth } from '@/composables'
import { useSubscription } from '@/composables'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { emitEvent, onEvent } from '@/infrastructure/events/event-bus'
import { supabase } from '@/infrastructure/supabase/client'
import { chromeStorage } from '@/infrastructure/storage/chrome-storage'
import { websiteUrls, openWebsiteUrl } from '@/config/website'

const NICKNAME_KEY = 'user.nickname'

// 使用 Supabase Auth
const {
  user,
  session,
  signOut: supabaseSignOut,
  isAuthenticated
} = useSupabaseAuth()

// 使用订阅服务获取订阅状态
const { subscriptionStatus } = useSubscription()

const nickname = ref('')
const isLoggingOut = ref(false)

// 用户邮箱
const userEmail = computed(() => {
  return user.value?.email || ''
})

// 当前登录的 provider（从本地存储读取）
const storedLoginProvider = ref<string | null>(null)

// 登录方式（从 user_metadata 或本地存储获取）
const loginProvider = computed(() => {
  if (!user.value) {
    return null
  }

  // 🔑 优先使用本地存储的 provider（最准确，因为是在登录时保存的）
  if (
    storedLoginProvider.value === 'google' ||
    storedLoginProvider.value === 'github' ||
    storedLoginProvider.value === 'microsoft'
  ) {
    return storedLoginProvider.value
  }

  // 优先使用 app_metadata.provider（当前登录方式）
  const appProvider = user.value.app_metadata?.provider
  const userMetadataProvider = user.value.user_metadata?.provider

  // 检查 providers 数组（可能包含多个登录方式）
  const providers = user.value.user_metadata?.providers || []

  // 🔑 Supabase 内部使用 'azure' 作为 Microsoft 的 provider 名称
  // 我们统一映射为 'microsoft' 以保持一致性
  const normalizeProvider = (p: string | undefined) => p === 'azure' ? 'microsoft' : p

  // 优先使用 app_metadata.provider（当前登录方式）
  const normalizedAppProvider = normalizeProvider(appProvider)
  if (normalizedAppProvider === 'google' || normalizedAppProvider === 'github' || normalizedAppProvider === 'microsoft') {
    return normalizedAppProvider
  }

  // 其次使用 user_metadata.provider
  const normalizedUserProvider = normalizeProvider(userMetadataProvider)
  if (normalizedUserProvider === 'google' || normalizedUserProvider === 'github' || normalizedUserProvider === 'microsoft') {
    return normalizedUserProvider
  }

  // 最后使用 providers 数组的最后一个
  if (providers.length > 0) {
    const lastProvider = normalizeProvider(providers[providers.length - 1])
    if (lastProvider === 'google' || lastProvider === 'github' || lastProvider === 'microsoft') {
      return lastProvider
    }
  }

  return null
})

// 登录方式显示名称
const loginProviderName = computed(() => {
  const provider = loginProvider.value
  if (provider === 'google') return t('settings_account_provider_google')
  if (provider === 'github') return t('settings_account_provider_github')
  if (provider === 'microsoft') return t('settings_account_provider_microsoft')
  if (provider === 'email') return t('settings_account_provider_email')
  return provider || t('settings_account_provider_unknown')
})

// 登录方式图标文本
const loginProviderIconText = computed(() => {
  const provider = loginProvider.value
  if (provider === 'google') return 'G'
  if (provider === 'github') return '⚡' // 使用 GitHub 的 octocat 符号，或者用 'GH'
  if (provider === 'microsoft') return 'M'
  if (provider === 'email') return '@'
  return '?'
})

// 登录方式颜色
const loginProviderColor = computed(() => {
  const provider = loginProvider.value
  if (provider === 'google') return 'primary'
  if (provider === 'github') return 'secondary'
  if (provider === 'microsoft') return 'info'
  if (provider === 'email') return 'info'
  return 'secondary'
})

// 订阅等级
const subscriptionTier = computed(() => {
  const tier = subscriptionStatus.value?.tier || 'free'
  return tier
})

// 头像 URL（从 user_metadata 获取）
const avatarUrl = computed(() => {
  if (!user.value) return undefined
  
  // 优先级：
  // 1. avatar_url（通用字段）
  // 2. picture（Google 使用）
  // 3. avatar（Microsoft 可能使用）
  // 4. photo（某些 OAuth 提供商使用）
  return (
    user.value.user_metadata?.avatar_url ||
    user.value.user_metadata?.picture ||
    user.value.user_metadata?.avatar ||
    user.value.user_metadata?.photo ||
    undefined
  )
})

// 头像首字母（从邮箱或昵称提取）
const avatarInitial = computed(() => {
  if (nickname.value) {
    return nickname.value.charAt(0).toUpperCase()
  }
  if (userEmail.value) {
    return userEmail.value.charAt(0).toUpperCase()
  }
  return '?'
})

onMounted(async () => {
  // 读取本地存储的 provider
  try {
    const savedProvider = await chromeStorage.getLocal<string>(
      'current_login_provider'
    )
    storedLoginProvider.value = savedProvider || null
  } catch (error) {
    console.error('[AccountSettings] ❌ 读取本地存储 provider 失败:', error)
  }

  if (!isAuthenticated.value) {
    return
  }

  // 加载用户信息和订阅状态
  await refreshUserInfo()

  // 监听页面可见性变化，当从其他页面返回时刷新登录状态
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // ✅ 监听登录事件，实时更新状态
  const unsubscribeLogin = onEvent('auth:logged-in', async () => {
    // 重新读取 provider（登录后可能更新）
    try {
      const savedProvider = await chromeStorage.getLocal<string>(
        'current_login_provider'
      )
      storedLoginProvider.value = savedProvider || null
    } catch (error) {
      console.error('[AccountSettings] ❌ 读取本地存储 provider 失败:', error)
    }

    // 🔑 OAuth 登录后，等待用户信息同步（Google 的 user_metadata 可能需要一点时间）
    await new Promise(resolve => setTimeout(resolve, 300))

    // 刷新用户信息（包括昵称和头像）
    await refreshUserInfo()

    // 🔑 如果第一次刷新后还没有昵称/头像，再等待并重试一次
    const currentUser = user.value
    if (
      currentUser &&
      !currentUser.user_metadata?.nickname &&
      !currentUser.user_metadata?.full_name &&
      !currentUser.user_metadata?.picture
    ) {
      await new Promise(resolve => setTimeout(resolve, 500))
      await refreshUserInfo()
    }
  })

  const unsubscribeLogout = onEvent('auth:logged-out', () => {
    nickname.value = ''
    storedLoginProvider.value = null // 清除 provider
  })

  // 清理函数
  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    unsubscribeLogin()
    unsubscribeLogout()
  })
})

// 处理页面可见性变化
function handleVisibilityChange() {
  // 当页面从隐藏变为可见时，重新检查登录状态
  // 这可以捕获从注册页面返回的情况
  if (!document.hidden && isAuthenticated.value) {
    refreshUserInfo()
  }
}

/**
 * 刷新用户信息
 * 从 Supabase 和订阅服务获取最新信息
 */
async function refreshUserInfo() {
  if (!isAuthenticated.value || !user.value || !session.value) {
    return
  }

  try {
    // 🔑 OAuth 登录后，主动刷新用户信息，确保获取到完整的 user_metadata
    // 因为 OAuth 登录时，user_metadata 可能需要一点时间同步
    let currentUser = user.value
    try {
      const {
        data: { user: refreshedUser },
        error: refreshError
      } = await supabase.auth.getUser()
      if (!refreshError && refreshedUser) {
        // 使用刷新后的用户信息（包含最新的 user_metadata）
        currentUser = refreshedUser
      } else if (refreshError) {
        console.warn(
          '[AccountSettings] ⚠️ 刷新用户信息失败，使用当前 user:',
          refreshError
        )
      }
    } catch (refreshErr) {
      console.warn(
        '[AccountSettings] ⚠️ 刷新用户信息异常，使用当前 user:',
        refreshErr
      )
    }

    // 订阅状态由 useSubscription 的 watchEffect 自动加载，无需手动调用

    // 从 user_metadata 获取昵称（只读，来自 OAuth）
    // 优先级：full_name（Google 全名） > name（Google 名称） > 邮箱用户名
    let displayName = ''

    if (currentUser?.user_metadata?.full_name) {
      // 使用 Google 全名（Display name）
      displayName = currentUser.user_metadata.full_name
    } else if (currentUser?.user_metadata?.name) {
      // 使用 Google 名称或其他 provider 的名称
      displayName = currentUser.user_metadata.name
    } else if (currentUser?.email) {
      // 如果都没有，从邮箱地址提取用户名作为默认昵称
      // 例如：impensmee74@hotmail.com -> impensmee74
      const emailPrefix = currentUser.email.split('@')[0]
      if (emailPrefix && emailPrefix.length > 0) {
        displayName = emailPrefix
      }
    }

    nickname.value = displayName
  } catch (error) {
    console.error('[AccountSettings] ❌ 刷新用户信息失败:', error)
  }
}

async function logout() {
  if (isLoggingOut.value) return // 防止重复点击

  try {
    isLoggingOut.value = true

    // 使用 Supabase 登出
    await supabaseSignOut()

    // 清除本地缓存的昵称
    await settingsAppService.deleteSetting(NICKNAME_KEY)

    // 发送退出登录事件，通知其他组件更新状态
    emitEvent('auth:logged-out', {})

    // 跳转到官网登录页面
    await openWebsiteUrl(websiteUrls.login)
  } catch (error) {
    console.error('[AccountSettings] ❌ 登出失败:', error)
    isLoggingOut.value = false
    // 即使登出失败，也尝试跳转到登录页面
    try {
      await openWebsiteUrl(websiteUrls.login)
    } catch (e) {
      console.error('[AccountSettings] Failed to navigate to login page:', e)
    }
  }
}
</script>
<style scoped>
.settings-section {
  margin-bottom: var(--spacing-6);
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
}

.grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.label {
  width: 120px;
  color: var(--color-text-secondary);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.text-secondary {
  color: var(--color-text-secondary);
}

/* 安全子视图样式 */
.security-box {
  margin-top: var(--spacing-1);
}

.subtitle {
  margin-bottom: var(--spacing-1);
  font-weight: 600;
}

.form-grid {
  display: grid;
  align-items: center;
  gap: var(--spacing-sm);
  grid-template-columns: 140px 1fr;
  max-width: 560px;
}

.form-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.form-input {
  width: 100%;
  max-width: 400px;
  padding: var(--spacing-sm) 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--spacing-sm);
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-2);
}

.email {
  font-weight: 500;
  color: var(--color-text-primary);
}

.nickname-text {
  font-weight: 500;
  color: var(--color-text-primary);
}

.email-with-provider {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
}

.provider-icon-text {
  margin-right: var(--spacing-1);
  font-size: var(--text-xs);
  font-weight: 600;
}
</style>
