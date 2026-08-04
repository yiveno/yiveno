<script setup lang="ts">
import type { User } from '@supabase/supabase-js'
import { ref, onMounted } from 'vue'
import { getSupabase } from '../services/supabase'
import { getUserSubscription, type UserSubscription } from '../services/subscription'
import { formatDate } from '../services/date'
import {
  handoffSignOutToExtension,
  rememberConnectedExtensionId,
  extractProfileFromUserMetadata
} from '../services/extension-auth-handoff'

const user = ref<User | null>(null)
const profileAvatarUrl = ref('')
const profileDisplayName = ref('')
const subscription = ref<UserSubscription | null>(null)
const loading = ref(true)

onMounted(async () => {
  // 扩展打开账户页会带 extension_id，记住以便退出回传
  const params = new URLSearchParams(window.location.search)
  const extensionId = params.get('extension_id')?.trim()
  if (extensionId) {
    rememberConnectedExtensionId(extensionId)
  }

  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  if (!data?.session?.user) {
    // 未登录访问账户页：直接进登录，不展示「请先登录」中间态
    window.location.replace('/login')
    return
  }
  user.value = data.session.user
  const profile = extractProfileFromUserMetadata(
    data.session.user.user_metadata as Record<string, unknown> | undefined
  )
  profileAvatarUrl.value = profile.avatarUrl ?? ''
  profileDisplayName.value = profile.displayName ?? data.session.user.email ?? ''
  const sub = await getUserSubscription(data.session.user.id)
  if (sub) subscription.value = sub
  loading.value = false
})

async function handleSignOut() {
  const supabase = await getSupabase()
  await supabase.auth.signOut()
  // 通知扩展清登录态（keep_local）；失败不阻塞官网退出
  try {
    await handoffSignOutToExtension()
  } catch (error) {
    console.warn('[AccountPage] extension sign-out handoff failed', error)
  }
  window.location.href = '/'
}
</script>

<template>
  <div v-if="!loading" class="account-page">
    <div v-if="user" class="card">
      <div class="user-header">
        <img v-if="profileAvatarUrl" :src="profileAvatarUrl" class="avatar" alt="" />
        <div>
          <h2>{{ profileDisplayName || user.email }}</h2>
          <p class="email">{{ user.email }}</p>
        </div>
      </div>
      <section>
        <h3>订阅计划</h3>
        <p>
          当前计划：<strong>{{ subscription ? subscription.plan_id : '免费版' }}</strong>
        </p>
      </section>
      <section>
        <h3>账户信息</h3>
        <dl>
          <dt>登录方式</dt>
          <dd>{{ user.app_metadata?.provider || '未知' }}</dd>
          <dt>注册时间</dt>
          <dd>{{ formatDate(user.created_at) }}</dd>
          <dt>上次登录</dt>
          <dd>{{ formatDate(user.last_sign_in_at) }}</dd>
        </dl>
      </section>
      <button class="btn" @click="handleSignOut">退出登录</button>
      <p class="sign-out-hint">扩展本机记忆仍保留；若要清除请到扩展设置。</p>
    </div>
  </div>
  <div v-else class="loading">加载中...</div>
</template>

<style scoped>
.account-page {
  max-width: 600px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 2rem;
}

.user-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
}

.email {
  color: #666;
  font-size: 0.875rem;
}

section {
  margin: 1.5rem 0;
}

dl dt {
  font-weight: 600;
  margin-top: 0.5rem;
  color: #333;
}

dl dd {
  margin: 0.25rem 0 0;
  color: #666;
  font-size: 0.9rem;
}

.btn {
  padding: 0.5rem 1.5rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}

.btn:hover {
  background: #f5f5f5;
}

.sign-out-hint {
  margin: 0.75rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #666;
}

.loading {
  text-align: center;
  padding: 4rem;
  color: #999;
}
</style>
