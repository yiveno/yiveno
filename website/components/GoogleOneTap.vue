<!--
  Google One Tap 登录组件
  
  功能：
  - 自动显示 Google One Tap 登录提示
  - 与 Supabase Auth 集成
  - 智能显示逻辑（避免重复打扰用户）
  - 支持自定义显示条件
-->
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { User } from '@supabase/supabase-js'

interface Props {
  /**
   * 是否自动显示 One Tap 提示
   * @default true
   */
  autoPrompt?: boolean

  /**
   * 是否在用户关闭后记住选择
   * @default true
   */
  rememberDismissal?: boolean

  /**
   * One Tap 冷却期（秒）
   * 用户关闭后多久再显示
   * @default 3600 (1小时)
   */
  cooldownPeriod?: number
}

const props = withDefaults(defineProps<Props>(), {
  autoPrompt: true,
  rememberDismissal: true,
  cooldownPeriod: 3600
})

const emit = defineEmits<{
  success: [user: User]
  error: [error: Error]
  dismissed: []
}>()

const { signInWithGoogleOneTap, user } = useAuth()
const config = useRuntimeConfig()

const isScriptLoaded = ref(false)
const isInitialized = ref(false)

/**
 * 检查是否应该显示 One Tap
 */
const shouldShowOneTap = (): boolean => {
  // 1. 用户已登录，不显示
  if (user.value) {
    console.log('[GoogleOneTap] 用户已登录，跳过 One Tap')
    return false
  }

  // 2. 检查用户是否主动关闭过
  if (props.rememberDismissal) {
    const dismissedAt = localStorage.getItem('google_onetap_dismissed_at')
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10)
      const now = Date.now()
      const cooldownMs = props.cooldownPeriod * 1000

      if (now - dismissedTime < cooldownMs) {
        console.log('[GoogleOneTap] 在冷却期内，跳过 One Tap')
        return false
      }
    }
  }

  return true
}

/**
 * 处理 Google One Tap 登录回调
 */
const handleCredentialResponse = async (response: { credential: string }) => {
  try {
    console.log('[GoogleOneTap] 收到凭证，开始登录...')

    const result = await signInWithGoogleOneTap(response.credential)

    console.log('[GoogleOneTap] 登录成功:', result.user?.email)

    // 清除关闭记录
    if (props.rememberDismissal) {
      localStorage.removeItem('google_onetap_dismissed_at')
    }

    emit('success', result.user)

    // 跳转到账户页面
    await navigateTo('/account')
  } catch (error) {
    console.error('[GoogleOneTap] 登录失败:', error)
    emit('error', error instanceof Error ? error : new Error('One Tap 登录失败'))
  }
}

/**
 * 初始化 Google One Tap
 */
const initializeOneTap = () => {
  if (!window.google?.accounts?.id) {
    console.error('[GoogleOneTap] Google Identity Services SDK 未加载')
    return
  }

  if (isInitialized.value) {
    console.log('[GoogleOneTap] 已初始化，跳过')
    return
  }

  if (!shouldShowOneTap()) {
    console.log('[GoogleOneTap] 不满足显示条件，跳过初始化')
    return
  }

  try {
    console.log('[GoogleOneTap] 开始初始化...')

    // nonce 由 Supabase 后台的 "Skip nonce check" 选项跳过验证
    // 无需在代码层面处理 nonce
    window.google.accounts.id.initialize({
      client_id: config.public.googleClientId,
      callback: handleCredentialResponse,
      auto_select: true,
      cancel_on_tap_outside: false,
      context: 'signin',
      ux_mode: 'popup',
      itp_support: true,
      use_fedcm_for_prompt: false
    } as Parameters<typeof window.google.accounts.id.initialize>[0])

    isInitialized.value = true
    console.log('[GoogleOneTap] 初始化成功')

    // 显示 One Tap 提示
    if (props.autoPrompt) {
      promptOneTap()
    }
  } catch (error) {
    console.error('[GoogleOneTap] 初始化失败:', error)
  }
}

/**
 * 显示 One Tap 提示
 */
const promptOneTap = () => {
  if (!window.google?.accounts?.id) {
    console.error('[GoogleOneTap] Google Identity Services SDK 未加载')
    return
  }

  console.log('[GoogleOneTap] 显示 One Tap 提示...')

  window.google.accounts.id.prompt(
    (notification: {
      getMomentType: () => string
      isNotDisplayed: () => boolean
      getNotDisplayedReason: () => string
      isSkippedMoment: () => boolean
      isDismissedMoment: () => boolean
    }) => {
      console.log('[GoogleOneTap] 提示状态:', notification.getMomentType())

      if (notification.isNotDisplayed()) {
        console.log('[GoogleOneTap] 未显示原因:', notification.getNotDisplayedReason())
      }

      if (notification.isSkippedMoment()) {
        console.log('[GoogleOneTap] 用户跳过了 One Tap')

        // 记录用户关闭时间
        if (props.rememberDismissal) {
          localStorage.setItem('google_onetap_dismissed_at', Date.now().toString())
        }

        emit('dismissed')
      }

      if (notification.isDismissedMoment()) {
        console.log('[GoogleOneTap] 用户关闭了 One Tap')

        // 记录用户关闭时间
        if (props.rememberDismissal) {
          localStorage.setItem('google_onetap_dismissed_at', Date.now().toString())
        }

        emit('dismissed')
      }
    }
  )
}

/**
 * 加载 Google Identity Services SDK
 */
const loadGoogleScript = () => {
  // 检查是否已加载
  if (window.google?.accounts?.id) {
    console.log('[GoogleOneTap] SDK 已加载')
    isScriptLoaded.value = true
    initializeOneTap()
    return
  }

  // 检查是否已有 script 标签
  const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
  if (existingScript) {
    console.log('[GoogleOneTap] SDK 正在加载中...')
    existingScript.addEventListener('load', () => {
      isScriptLoaded.value = true
      initializeOneTap()
    })
    return
  }

  console.log('[GoogleOneTap] 开始加载 SDK...')

  // 创建 script 标签
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.defer = true

  script.onload = () => {
    console.log('[GoogleOneTap] SDK 加载成功')
    isScriptLoaded.value = true
    initializeOneTap()
  }

  script.onerror = () => {
    console.error('[GoogleOneTap] SDK 加载失败')
  }

  document.head.appendChild(script)
}

/**
 * 清理函数
 */
const cleanup = () => {
  if (window.google?.accounts?.id) {
    // 取消 One Tap 提示
    window.google.accounts.id.cancel()
  }
}

// 生命周期
onMounted(() => {
  // 仅在客户端执行
  if (typeof window === 'undefined') return

  // 检查是否有 Google Client ID
  if (!config.public.googleClientId) {
    console.error('[GoogleOneTap] 缺少 NUXT_PUBLIC_GOOGLE_CLIENT_ID 环境变量')
    return
  }

  // 加载 Google SDK
  loadGoogleScript()
})

onUnmounted(() => {
  cleanup()
})

// 暴露方法给父组件
defineExpose({
  prompt: promptOneTap,
  cancel: cleanup
})
</script>

<template>
  <!-- One Tap 会自动渲染，不需要模板内容 -->
  <div v-if="false" />
</template>

<style scoped>
/* One Tap 由 Google SDK 自动渲染，无需自定义样式 */
</style>
