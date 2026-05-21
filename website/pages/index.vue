<script setup lang="ts">
import Hero from '@/components/landing/Hero.vue'
import PainPoints from '@/components/landing/PainPoints.vue'
import Features from '@/components/landing/Features.vue'
import Pricing from '@/components/landing/Pricing.vue'
import Button from '@/components/ui/Button.vue'
import GoogleOneTap from '@/components/GoogleOneTap.vue'

const NuxtLink = resolveComponent('NuxtLink')
const { extensionLink } = useProductLinks()
const { user } = useAuth()

const openExtension = () => {
  if (extensionLink) {
    window.open(extensionLink, '_blank')
  }
}

/**
 * 处理 One Tap 登录成功
 */
const handleOneTapSuccess = (userData: { email?: string }) => {
  console.log('[Index] One Tap 登录成功:', userData.email)
  // 可以在这里显示欢迎消息或其他 UI 反馈
}

/**
 * 处理 One Tap 登录失败
 */
const handleOneTapError = (error: Error) => {
  console.error('[Index] One Tap 登录失败:', error.message)
  // 可以在这里显示错误提示
}

/**
 * 处理用户关闭 One Tap
 */
const handleOneTapDismissed = () => {
  console.log('[Index] 用户关闭了 One Tap')
  // 可以在这里记录用户行为
}

useSeoMeta({
  title: 'AcuityBookmarks · AI 驱动的智能书签工作台',
  description:
    'Fuse.js 模糊检索 × AI 语义推荐 × Cloudflare Worker API。AcuityBookmarks 为高密度知识工作者打造极速、离线、安全的书签体验。',
  ogTitle: 'AcuityBookmarks · AI 驱动的智能书签工作台',
  ogDescription:
    '结合离线索引、AI 推荐、失效检测和 Cloudflare Worker，重新定义书签管理。',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <div class="landing-page">
    <!-- Google One Tap 登录（仅在未登录时显示） -->
    <GoogleOneTap
      v-if="!user"
      :auto-prompt="true"
      :remember-dismissal="true"
      :cooldown-period="3600"
      @success="handleOneTapSuccess"
      @error="handleOneTapError"
      @dismissed="handleOneTapDismissed"
    />

    <Hero :extension-link="extensionLink">
      <template #showcase>
        <!-- Placeholder for dashboard screenshot -->
        <div class="w-full h-full bg-bg-depth relative overflow-hidden">
          <!-- Mockup UI -->
          <div
            class="absolute inset-0 bg-[url('/dashboard-preview.png')] bg-cover bg-center opacity-50"
          ></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <div
              class="text-center p-6 bg-bg-surface/80 backdrop-blur-sm rounded-xl border border-white/10 max-w-md"
            >
              <h2 class="text-xl font-bold mb-2">Your Knowledge OS</h2>
              <p class="text-sm text-content-muted">
                Imagine your bookmarks organized automatically by AI.
              </p>
            </div>
          </div>
        </div>
      </template>
    </Hero>

    <PainPoints />

    <Features />

    <Pricing />

    <section class="py-16 relative overflow-hidden">
      <div
        class="absolute inset-0 bg-gradient-to-b from-bg-depth to-primary-900/20 z-0"
      ></div>
      <div class="container mx-auto px-4 relative z-10 text-center">
        <h3 class="text-2xl md:text-4xl font-bold mb-4 max-w-2xl mx-auto">
          准备好重塑您的<span class="text-accent-400">知识工作流</span>了吗？
        </h3>
        <p class="text-base text-content-muted mb-8 max-w-xl mx-auto leading-relaxed">
          立即安装扩展，或约我们演示如何把 AcuityBookmarks 部署到你的团队。
        </p>
        <div class="flex flex-col sm:flex-row justify-center gap-3">
          <Button @click="openExtension">免费安装扩展</Button>
          <Button variant="secondary" to="/contact" :as="NuxtLink">预约演示</Button>
        </div>
      </div>
    </section>
  </div>
</template>
