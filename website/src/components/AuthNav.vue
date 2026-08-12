<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getSession } from '../services/auth'
import { extractProfileFromUserMetadata } from '../services/extension-auth-handoff'

const user = ref<{ email?: string; avatarUrl?: string; name?: string } | null>(null)
const loading = ref(true)

onMounted(async () => {
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
  }
  loading.value = false
})
</script>

<template>
  <div class="auth-nav">
    <a v-if="loading" href="/login" class="nav-link">Sign in</a>
    <a v-else-if="!user" href="/login" class="nav-link">Sign in</a>
    <a v-else href="/account" class="nav-link user-info">
      <img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" class="avatar" />
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
  color: #555;
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
}
</style>
