<template>
  <div class="min-h-screen flex flex-col bg-bg-default text-content font-sans">
    <header
      class="sticky top-0 z-50 w-full border-b border-white/5 bg-bg-default/80 backdrop-blur-xl"
    >
      <div
        class="container mx-auto px-4 h-20 flex items-center justify-between"
      >
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2 group">
          <img 
            src="/logo.webp" 
            alt="AcuityBookmarks Logo" 
            class="w-8 h-8 object-contain group-hover:scale-105 transition-transform"
          />

        </NuxtLink>

        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center gap-8">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.label"
            :to="link.to"
            class="text-sm font-medium text-content-muted hover:text-primary-400 transition-colors"
            active-class="text-primary-400"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>

        <!-- Actions -->
        <div class="flex items-center gap-3">
          <!-- 未登录：点击直接跳转登录页 -->
          <button
            v-if="!isAuthenticated"
            @click="navigateToLogin"
            class="hidden sm:flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/5 transition-colors"
            aria-label="登录"
            title="登录"
          >
            <Icon name="lucide:circle-user" class="w-7 h-7 text-content-muted" />
          </button>
          
          <!-- 已登录：hover 显示下拉菜单 -->
          <div
            v-else
            class="hidden sm:block relative"
            @mouseenter="showUserMenu = true"
            @mouseleave="showUserMenu = false"
          >
            <button
              :class="[
                'flex items-center justify-center w-10 h-10 rounded-full transition-all',
                isPro 
                  ? 'ring-2 ring-yellow-400 hover:ring-yellow-300 hover:shadow-[0_0_16px_rgba(251,191,36,0.6)]' 
                  : 'ring-2 ring-primary-400 hover:ring-primary-300 hover:bg-white/5'
              ]"
              :title="displayName"
              aria-label="用户菜单"
            >
              <div class="user-avatar-wrapper">
                <img 
                  v-if="userAvatar && !navAvatarFailed" 
                  :src="userAvatar" 
                  :alt="displayName"
                  class="user-avatar-image"
                  @error="navAvatarFailed = true"
                />
                <div v-else class="user-avatar">
                  {{ userInitial }}
                </div>
              </div>
              
              <!-- PRO 徽章 -->
              <div v-if="isPro" class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg">
                <Icon name="lucide:crown" class="w-3 h-3 text-white" />
              </div>
            </button>
            
            <!-- 下拉菜单 -->
            <Transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <div
                v-show="showUserMenu"
                class="absolute right-0 mt-2 w-56 rounded-lg bg-bg-depth border border-white/10 shadow-lg overflow-hidden"
              >
                <!-- 用户信息 -->
                <div class="px-4 py-3 border-b border-white/5">
                  <div class="text-sm font-medium text-content">{{ displayName }}</div>
                  <div class="text-xs text-content-muted mt-1">{{ user?.email }}</div>
                  <div class="flex items-center gap-2 mt-2">
                    <Icon :name="isPro ? 'lucide:crown' : 'lucide:circle'" class="w-3 h-3" :class="isPro ? 'text-yellow-400' : 'text-primary-400'" />
                    <span class="text-xs font-medium" :class="isPro ? 'text-yellow-400' : 'text-primary-400'">
                      {{ isPro ? 'PRO 方案' : 'FREE 方案' }}
                    </span>
                  </div>
                </div>
                
                <!-- 菜单项 -->
                <div class="py-1">
                  <NuxtLink
                    to="/account"
                    class="flex items-center gap-3 px-4 py-2 text-sm text-content-muted hover:bg-white/5 hover:text-content transition-colors"
                  >
                    <Icon name="lucide:user" class="w-4 h-4" />
                    <span>账户设置</span>
                  </NuxtLink>
                  
                  <NuxtLink
                    to="/account/subscription"
                    class="flex items-center gap-3 px-4 py-2 text-sm text-content-muted hover:bg-white/5 hover:text-content transition-colors"
                  >
                    <Icon name="lucide:credit-card" class="w-4 h-4" />
                    <span>订阅管理</span>
                  </NuxtLink>
                  
                  <div class="border-t border-white/5 my-1"></div>
                  
                  <button
                    @click="handleLogout"
                    class="w-full flex items-center gap-3 px-4 py-2 text-sm text-content-muted hover:bg-white/5 hover:text-red-400 transition-colors"
                  >
                    <Icon name="lucide:log-out" class="w-4 h-4" />
                    <span>退出登录</span>
                  </button>
                </div>
              </div>
            </Transition>
          </div>
          
          <Button size="sm" @click="openExtension"> 添加到 Chrome </Button>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-white/5 bg-bg-depth pt-20 pb-10">
      <div class="container mx-auto px-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <!-- Brand Column -->
          <div class="md:col-span-1">
            <div class="font-bold text-xl mb-4 text-content">
              AcuityBookmarks
            </div>
            <p class="text-content-muted text-sm leading-relaxed mb-6">
              AI
              驱动的智能书签工作台，帮助高密度信息工作者在任何设备、任何网络环境下快速找到灵感与知识。
            </p>
            <div class="flex gap-3">
              <NuxtLink
                to="/about"
                class="text-xs border border-white/10 px-3 py-1 rounded-full hover:bg-white/5 transition-colors"
                >了解团队</NuxtLink
              >
              <NuxtLink
                to="/feature-request"
                class="text-xs border border-white/10 px-3 py-1 rounded-full hover:bg-white/5 transition-colors"
                >提交需求</NuxtLink
              >
            </div>
          </div>

          <!-- Links Columns -->
          <div
            v-for="group in footerGroups"
            :key="group.title"
            class="flex flex-col gap-4"
          >
            <div
              class="text-xs font-bold uppercase tracking-widest text-content-subtle"
            >
              {{ group.title }}
            </div>
            <ul class="space-y-3">
              <li v-for="item in group.links" :key="item.label">
                <component
                  :is="item.external ? 'a' : NuxtLink"
                  :href="item.external ? item.to : undefined"
                  :to="item.external ? undefined : item.to"
                  :target="item.external ? '_blank' : undefined"
                  class="text-sm text-content-muted hover:text-primary-400 transition-colors"
                >
                  {{ item.label }}
                </component>
              </li>
            </ul>
          </div>
        </div>

        <div
          class="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4"
        >
          <p class="text-xs text-content-subtle">
            © {{ copyrightYear }} AcuityBookmarks. All rights reserved.
          </p>
          <div class="flex gap-6 text-xs text-content-muted">
            <NuxtLink to="/privacy" class="hover:text-content"
              >隐私政策</NuxtLink
            >
            <NuxtLink to="/terms" class="hover:text-content">使用条款</NuxtLink>
            <a
              href="https://github.com/ChenQiWen/acuityBookmarks"
              target="_blank"
              class="hover:text-content"
              >GitHub</a
            >
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Button from '@/components/ui/Button.vue'

const NuxtLink = resolveComponent('NuxtLink')
const router = useRouter()
const { extensionLink } = useProductLinks()
const { setupAuthListener, setupStorageListener, user, isAuthenticated, initialize, signOut } = useAuth()
const { isPro, isInitialized: subscriptionInitialized, loadSubscription } = useSubscription()
const copyrightYear = new Date().getFullYear()
const navAvatarFailed = ref(false)
const showUserMenu = ref(false)

// 🐛 调试日志
watch([isAuthenticated, isPro, subscriptionInitialized], ([auth, pro, init]) => {
  console.log('[Layout] 状态变化:', {
    isAuthenticated: auth,
    isPro: pro,
    subscriptionInitialized: init
  })
})

// 🔥 监听登录状态变化，自动刷新订阅
watch(isAuthenticated, async (newAuth, oldAuth) => {
  if (newAuth && !oldAuth) {
    // 用户刚登录，刷新订阅状态
    console.log('[Layout] 用户登录，刷新订阅状态')
    await loadSubscription(true)
  }
})

// 用户显示名称
const displayName = computed(() => {
  if (!user.value) return ''
  const meta = user.value.user_metadata
  return (
    meta?.full_name ||
    meta?.name ||
    user.value.email?.split('@')[0] ||
    '用户'
  )
})

// 用户头像首字母
const userInitial = computed(() => {
  if (!user.value) return '?'
  const name = displayName.value
  return name.charAt(0).toUpperCase()
})

// 用户头像 URL
const userAvatar = computed(() => {
  if (!user.value) return null
  const metadata = user.value.user_metadata
  return metadata?.avatar_url || metadata?.picture || null
})

// 未登录点击跳转登录页
const navigateToLogin = () => {
  router.push('/login')
}

// 退出登录
const handleLogout = async () => {
  try {
    await signOut()
    showUserMenu.value = false
    router.push('/')
  } catch (error) {
    console.error('[Layout] 退出登录失败:', error)
  }
}

// 设置认证状态监听
let cleanupStorageListener: (() => void) | undefined

onMounted(async () => {
  // 初始化认证状态
  await initialize()
  
  // 监听 Supabase 认证状态变化
  setupAuthListener()
  
  // 监听其他标签页/窗口的认证状态变化
  cleanupStorageListener = setupStorageListener()
  
  console.log('[Layout] 认证状态监听已启动')
  
  // 🔥 如果已登录，强制刷新订阅状态
  if (isAuthenticated.value) {
    console.log('[Layout] 已登录，强制刷新订阅状态')
    await loadSubscription(true) // forceRefresh = true
  }
})

onUnmounted(() => {
  // 清理监听器
  if (cleanupStorageListener) {
    cleanupStorageListener()
  }
})

const openExtension = () => {
  if (extensionLink) {
    window.open(extensionLink, '_blank')
  }
}

const navLinks = [
  { label: '功能', to: '/features' },
  { label: '定价', to: '/pricing' },
  { label: '关于', to: '/about' },
  { label: '下载', to: '/download' }
]

const footerGroups = [
  {
    title: '产品',
    links: [
      { label: '功能总览', to: '/features' },
      { label: '定价方案', to: '/pricing' },
      { label: '下载扩展', to: '/download' }
    ]
  },
  {
    title: '资源',
    links: [
      { label: '产品路线图', to: '/feature-request' },
      { label: '发布日志', to: '/about' },
      {
        label: 'GitHub 仓库',
        to: 'https://github.com/ChenQiWen/acuityBookmarks',
        external: true
      }
    ]
  },
  {
    title: '支持',
    links: [
      { label: '关于我们', to: '/about' },
      { label: '联系团队', to: '/contact' },
      { label: '服务条款', to: '/terms' }
    ]
  }
]
</script>

<style scoped>
.user-avatar-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--acuity-primary-400), var(--acuity-primary-600));
  color: white;
  font-size: 14px;
  font-weight: 600;
}
</style>
