<script setup lang="ts">
import { TrendingUp, CheckCircle, AlertCircle, Users } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'

const { loading, error, success, submitFeatureRequest } = useFeatureRequest()

const form = reactive({
  email: '',
  feature: '',
  description: '',
  url: ''
})

const handleSubmit = async () => {
  try {
    await submitFeatureRequest(form)
    // 重置 reactive 表单字段是顺序执行的，ESLint 在这里会误报 require-atomic-updates
    // eslint-disable-next-line require-atomic-updates
    form.email = ''
    // eslint-disable-next-line require-atomic-updates
    form.feature = ''
    // eslint-disable-next-line require-atomic-updates
    form.description = ''
  } catch (_err) {
    // handled already
  }
}

const statusList = [
  { label: '本周票数最高', value: 'AI 自动标签' },
  { label: '下一版本', value: '团队权限 / SSO' },
  { label: '正在研发', value: '侧边栏上下文推荐' }
]

const popularRequests = [
  {
    title: 'AI 自动标签',
    description: '根据书签内容自动生成和推荐标签，减少手动分类工作。',
    votes: 156,
    status: 'In Progress',
    quarter: '2025 Q1'
  },
  {
    title: '团队协作空间',
    description: '支持创建团队工作区，共享书签集合和标签体系。',
    votes: 98,
    status: 'Planned',
    quarter: '2025 Q2'
  },
  {
    title: '浏览器历史集成',
    description: '将浏览历史与书签结合，提供更智能的推荐。',
    votes: 87,
    status: 'Planned',
    quarter: '2025 Q2'
  },
  {
    title: 'Markdown 笔记',
    description: '为每个书签添加 Markdown 格式的笔记和注释。',
    votes: 72,
    status: 'Under Review',
    quarter: 'TBD'
  }
]

useSeoMeta({
  title: '新功能预约 - AcuityBookmarks',
  description: '提交或投票你想要的功能，我们会同步在路线图中显示进度。'
})
</script>

<template>
  <div class="min-h-screen pb-20">
    <!-- Hero Section -->
    <section class="relative pt-32 pb-20 overflow-hidden">
      <div
        class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-accent-500/10 blur-[120px] -z-10"
      ></div>

      <div class="container mx-auto px-4">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6"
            >
              <span
                class="text-sm font-medium text-accent-400 tracking-wider uppercase"
                >Roadmap & Feedback</span
              >
            </div>

            <h1
              class="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight"
            >
              为下一批功能投票<br />
              <span
                class="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400"
                >或提交你的想法</span
              >
            </h1>

            <p class="text-lg text-content-muted leading-relaxed">
              所有需求都会进入公开路线图。欢迎提供使用场景、业务背景或附上截图，帮助我们快速理解痛点。
            </p>
          </div>

          <Card class="p-8 border-white/10 bg-bg-surface/60">
            <h2 class="text-xl font-bold mb-6 flex items-center">
              <TrendingUp class="w-5 h-5 mr-2 text-accent-400" />
              当前迭代
            </h2>
            <ul class="space-y-4">
              <li
                v-for="item in statusList"
                :key="item.label"
                class="flex justify-between items-center pb-4 border-b border-white/5 last:border-0"
              >
                <span class="text-content-muted text-sm">{{ item.label }}</span>
                <Badge variant="outline" class="font-mono text-xs">{{
                  item.value
                }}</Badge>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </section>

    <!-- Feature Request Form -->
    <section class="py-10">
      <div class="container mx-auto px-4 max-w-3xl">
        <Card class="p-10 border-white/10">
          <div class="mb-8">
            <h2 class="text-2xl font-bold mb-3">提交需求</h2>
            <p class="text-content-muted">
              留下邮箱以便我们在需求上线后通知你。
            </p>
          </div>

          <form class="space-y-6" @submit.prevent="handleSubmit">
            <div>
              <label for="email" class="block text-sm font-bold mb-2"
                >邮箱 *</label
              >
              <input
                id="email"
                v-model="form.email"
                type="email"
                required
                class="w-full bg-bg-depth border border-white/10 rounded-lg px-4 py-3 text-content focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-colors"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label for="feature" class="block text-sm font-bold mb-2"
                >功能名称 *</label
              >
              <input
                id="feature"
                v-model="form.feature"
                type="text"
                required
                class="w-full bg-bg-depth border border-white/10 rounded-lg px-4 py-3 text-content focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-colors"
                placeholder="例如：AI 自动标签"
              />
            </div>

            <div>
              <label for="description" class="block text-sm font-bold mb-2"
                >使用场景</label
              >
              <textarea
                id="description"
                v-model="form.description"
                rows="5"
                class="w-full bg-bg-depth border border-white/10 rounded-lg px-4 py-3 text-content focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-colors resize-vertical"
                placeholder="描述为什么需要这个功能，最好附上你当前的 workaround。"
              ></textarea>
            </div>

            <!-- Honeypot -->
            <input
              v-model="form.url"
              type="text"
              name="url"
              autocomplete="off"
              tabindex="-1"
              class="absolute -left-[9999px]"
              aria-hidden="true"
            />

            <div class="flex items-center gap-4">
              <Button type="submit" :disabled="loading" :loading="loading">
                {{ loading ? '提交中…' : '提交需求' }}
              </Button>

              <transition name="fade">
                <div
                  v-if="success"
                  class="flex items-center text-green-400 text-sm"
                >
                  <CheckCircle class="w-4 h-4 mr-2" />
                  感谢你的建议！
                </div>
              </transition>
            </div>

            <p v-if="error" class="text-red-400 text-sm flex items-center">
              <AlertCircle class="w-4 h-4 mr-2" />
              {{ error }}
            </p>
          </form>
        </Card>
      </div>
    </section>

    <!-- Popular Requests -->
    <section class="py-20 bg-white/[0.02] border-y border-white/5">
      <div class="container mx-auto px-4 max-w-5xl">
        <div class="text-center mb-12">
          <h2 class="text-2xl font-bold mb-4">热门需求</h2>
          <p class="text-content-muted">社区投票最高的功能请求</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            v-for="request in popularRequests"
            :key="request.title"
            class="p-6 border-white/10 hover:border-primary-500/30 transition-colors"
          >
            <div class="flex items-start justify-between mb-4">
              <h3 class="font-bold text-lg">{{ request.title }}</h3>
              <Badge
                :variant="
                  request.status === 'In Progress' ? 'default' : 'outline'
                "
                >{{ request.status }}</Badge
              >
            </div>
            <p class="text-content-muted text-sm mb-4">
              {{ request.description }}
            </p>
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center text-content-subtle">
                <Users class="w-4 h-4 mr-1" />
                {{ request.votes }} 票
              </div>
              <div class="text-accent-400">{{ request.quarter }}</div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
