<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getSession } from '../services/auth'

const user = ref<{ email?: string; avatar_url?: string; name?: string } | null>(null)
const loading = ref(true)

onMounted(async () => {
  const session = await getSession()
  if (session?.user) {
    user.value = {
      email: session.user.email,
      avatar_url: session.user.user_metadata?.avatar_url,
      name: session.user.user_metadata?.name || session.user.email
    }
  }
  loading.value = false
})
</script>

<template>
  <div class="auth-nav">
    <a v-if="loading" href="/login" class="nav-link">登录</a>
    <a v-else-if="!user" href="/login" class="nav-link">登录</a>
    <a v-else href="/account" class="nav-link user-info">
      <img v-if="user.avatar_url" :src="user.avatar_url" alt="" class="avatar" />
      <span>{{ user.name }}</span>
    </a>
  </div>
</template>

<style scoped>
.auth-nav { display:flex; align-items:center; gap:0.5rem; }
.nav-link { text-decoration:none; color:#555; }
.user-info { display:flex; align-items:center; gap:0.5rem; }
.avatar { width:28px; height:28px; border-radius:50%; }
</style>
