<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { getSession } from '../services/auth'
import {
  startWebsiteAuthLiveness,
  type WebsiteAuthLivenessStop
} from '../services/auth-session-liveness'
import { extractProfileFromUserMetadata } from '../services/extension-auth-handoff'
import { clearNavIsProCache, readNavIsProCache } from '../services/nav-pro-badge-cache'
import { subscribeExtensionAuthChanged } from '../services/ui-bridge'

defineOptions({ name: 'AuthNav' })

const user = ref<{ email?: string; avatarUrl?: string; name?: string } | null>(null)
/** Pro 时顶栏头像 1px Sage 环；优先读会话缓存，不对账堵导航。 */
const isPro = ref(false)
const loading = ref(true)
/** /login 页本身已是登录壳，顶栏不再挂 Sign in 入口 */
const isLoginPage = computed(() => {
  if (typeof window === 'undefined') {
    return false
  }
  return window.location.pathname === '/login' || window.location.pathname.startsWith('/login/')
})
let stopLiveness: WebsiteAuthLivenessStop | null = null
let stopExtensionAuth: (() => void) | null = null

function applyProFromCache(): void {
  const cached = readNavIsProCache()
  isPro.value = cached === true
}

async function loadAuthNav(): Promise<void> {
  const session = await getSession()
  if (session?.user) {
    const profile = extractProfileFromUserMetadata(
      session.user.user_metadata as Record<string, unknown> | undefined
    )
    user.value = {
      email: session.user.email,
      ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
      name: profile.displayName || session.user.email
    }
    applyProFromCache()
  } else {
    user.value = null
    isPro.value = false
  }
  loading.value = false
}

onMounted(() => {
  void loadAuthNav()
  void startWebsiteAuthLiveness(() => {
    user.value = null
    isPro.value = false
    clearNavIsProCache()
    void loadAuthNav()
  }).then(stop => {
    stopLiveness = stop
  })
  // 扩展登出/登录时刷新 Nav（同浏览器 UI 桥；可见页才有意义）
  stopExtensionAuth = subscribeExtensionAuthChanged(() => {
    if (document.visibilityState !== 'visible') {
      return
    }
    void loadAuthNav()
  })
})

onUnmounted(() => {
  stopLiveness?.()
  stopLiveness = null
  stopExtensionAuth?.()
  stopExtensionAuth = null
})
</script>

<template>
  <div class="auth-nav">
    <a v-if="!isLoginPage && loading" href="/login" class="nav-link">Sign in</a>
    <a v-else-if="!isLoginPage && !user" href="/login" class="nav-link">Sign in</a>
    <a v-else-if="user" href="/account" class="nav-link user-info">
      <img
        v-if="user.avatarUrl"
        :src="user.avatarUrl"
        alt=""
        class="avatar"
        :class="{ 'avatar--pro': isPro }"
      />
      <img
        v-else
        src="/images/logo-mark.svg"
        alt=""
        class="avatar avatar--brand"
        :class="{ 'avatar--pro': isPro }"
        width="28"
        height="28"
        decoding="async"
      />
      <span>{{ user.name }}</span>
    </a>
  </div>
</template>

<style scoped>
.auth-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-link {
  text-decoration: none;
  color: var(--nav-muted, #555);
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.005em;
}

.nav-link:hover,
.nav-link:focus-visible {
  color: var(--nav-fg, inherit);
}

.nav-link:focus-visible {
  outline: 2px solid var(--sage, #3d5348);
  outline-offset: 3px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  box-sizing: border-box;
}

.avatar--brand {
  box-sizing: border-box;
  padding: 4px;
  object-fit: contain;
  background: color-mix(in srgb, var(--sage, #4b6054) 12%, transparent);
}

/* 1px Sage：档位信号，无光晕 / 无加粗 */
.avatar--pro {
  box-shadow: 0 0 0 1px var(--sage, #4b6054);
}
</style>
