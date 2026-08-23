<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getSession } from '../services/auth'
import { extractProfileFromUserMetadata } from '../services/extension-auth-handoff'
import { readNavIsProCache } from '../services/nav-pro-badge-cache'

defineOptions({ name: 'AuthNav' })

const user = ref<{ email?: string; avatarUrl?: string; name?: string } | null>(null)
/** Pro 时顶栏头像 1px Sage 环；优先读会话缓存，不对账堵导航。 */
const isPro = ref(false)
const loading = ref(true)

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

function onVisibilityChange(): void {
  if (document.visibilityState !== 'visible' || !user.value) {
    return
  }
  // 从账户/定价回焦后缓存可能已更新
  applyProFromCache()
}

onMounted(() => {
  void loadAuthNav()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="auth-nav">
    <a v-if="loading" href="/login" class="nav-link">Sign in</a>
    <a v-else-if="!user" href="/login" class="nav-link">Sign in</a>
    <a v-else href="/account" class="nav-link user-info">
      <img
        v-if="user.avatarUrl"
        :src="user.avatarUrl"
        alt=""
        class="avatar"
        :class="{ 'avatar--pro': isPro }"
      />
      <span
        v-else
        class="avatar avatar--fallback"
        :class="{ 'avatar--pro': isPro }"
        aria-hidden="true"
      >
        {{ (user.name || '?').slice(0, 1).toUpperCase() }}
      </span>
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

.avatar--fallback {
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 500;
  color: var(--sage, #4b6054);
  background: color-mix(in srgb, var(--sage, #4b6054) 12%, transparent);
}

/* 1px Sage：档位信号，无光晕 / 无加粗 */
.avatar--pro {
  box-shadow: 0 0 0 1px var(--sage, #4b6054);
}
</style>
