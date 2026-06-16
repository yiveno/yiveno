<script setup lang="ts">
import type { User } from '@supabase/supabase-js'
import { ref, onMounted } from 'vue'
import { getSupabase } from '../services/supabase'
import { getUserSubscription, type UserSubscription } from '../services/subscription'
import { formatDate } from '../services/date'

const user = ref<User | null>(null)
const subscription = ref<UserSubscription | null>(null)
const loading = ref(true)

onMounted(async () => {
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  if (data?.session?.user) {
    user.value = data.session.user
    const sub = await getUserSubscription(data.session.user.id)
    if (sub) subscription.value = sub
  }
  loading.value = false
})

async function handleSignOut() {
  const supabase = await getSupabase()
  await supabase.auth.signOut()
  window.location.href = '/'
}
</script>

<template>
  <div v-if="!loading" class="account-page">
    <div v-if="user" class="card">
      <div class="user-header">
        <img
          v-if="user.user_metadata?.avatar_url"
          :src="user.user_metadata.avatar_url"
          class="avatar"
        />
        <div>
          <h2>{{ user.user_metadata?.name || user.email }}</h2>
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
    </div>
    <div v-else>
      <p>未登录。请先 <a href="/login">登录</a>。</p>
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

.loading {
  text-align: center;
  padding: 4rem;
  color: #999;
}
</style>
