<script setup lang="ts">
import { Users, Shield, Zap, GitBranch, Github } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'

const NuxtLink = resolveComponent('NuxtLink')

const stats = [
  { value: '12+', label: '核心贡献者' },
  { value: '40+', label: '社区 Pull Requests' },
  { value: '2019', label: '最早原型年份' }
]

const values = [
  {
    icon: Users,
    title: '用户至上',
    description: '定期与核心用户共创，路线图公开透明，投票即可影响排期。'
  },
  {
    icon: Shield,
    title: '隐私优先',
    description: '所有设计都以本地掌控为前提，云端只是可选协作能力。'
  },
  {
    icon: Zap,
    title: '持续打磨',
    description: '每周小版本，保持稳定迭代和性能改善。'
  },
  {
    icon: GitBranch,
    title: '开放共建',
    description: '欢迎 fork、提 issue、写文档，我们乐于帮助你贡献第一行代码。'
  }
]

const roadmap = [
  {
    quarter: '2025 Q1',
    title: 'AI 多模态推荐',
    description: '引入图像/音频上下文理解，提升侧边栏推荐准确度。'
  },
  {
    quarter: '2025 Q2',
    title: '团队权限 & 审计',
    description: '支持 SSO、空间权限、操作日志，方便企业部署。'
  },
  {
    quarter: '2025 Q3',
    title: '生态开放',
    description: '开放命令面板与事件 API，允许第三方扩展任务流。'
  }
]

useSeoMeta({
  title: '关于我们 - AcuityBookmarks',
  description: '认识 AcuityBookmarks 团队：使命、价值观、路线图与加入方式。'
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
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6"
            >
              <span
                class="text-sm font-medium text-accent-400 tracking-wider uppercase"
                >AcuityBookmarks Team</span
              >
            </div>

            <h1
              class="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight"
            >
              我们是一支相信<br />
              <span
                class="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400"
                >「知识应即时可达」</span
              ><br />
              的工程团队
            </h1>

            <p class="text-lg text-content-muted leading-relaxed">
              项目始于开源社区，现已遍布北京 / 上海 / 新加坡 /
              温哥华。我们热衷于打造真正帮助知识工作者的工具，也欢迎你一起共建。
            </p>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <Card
              v-for="stat in stats"
              :key="stat.label"
              class="p-6 text-center border-white/10"
            >
              <div class="text-3xl font-bold text-primary-400 mb-2">
                {{ stat.value }}
              </div>
              <div class="text-xs text-content-muted uppercase tracking-wider">
                {{ stat.label }}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>

    <!-- Mission & Values -->
    <section class="py-24 bg-white/[0.02] border-y border-white/5">
      <div class="container mx-auto px-4">
        <div class="text-center mb-16 max-w-3xl mx-auto">
          <div
            class="text-primary-400 text-sm font-bold uppercase tracking-widest mb-2"
          >
            使命 & 价值观
          </div>
          <h2 class="text-3xl md:text-4xl font-bold mb-4">
            让书签成为知识网络的入口
          </h2>
        </div>

        <div
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
        >
          <Card
            v-for="value in values"
            :key="value.title"
            class="p-8 border-white/10 hover:border-primary-500/30 transition-colors group"
          >
            <div
              class="w-12 h-12 rounded-lg bg-primary-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"
            >
              <component :is="value.icon" class="w-6 h-6 text-primary-400" />
            </div>
            <h3 class="text-xl font-bold mb-3">{{ value.title }}</h3>
            <p class="text-content-muted text-sm leading-relaxed">
              {{ value.description }}
            </p>
          </Card>
        </div>
      </div>
    </section>

    <!-- Roadmap -->
    <section class="py-24">
      <div class="container mx-auto px-4 max-w-4xl">
        <div class="text-center mb-16">
          <div
            class="text-accent-400 text-sm font-bold uppercase tracking-widest mb-2"
          >
            路线图速览
          </div>
          <h2 class="text-3xl md:text-4xl font-bold mb-4">
            公开透明的版本计划
          </h2>
        </div>

        <div class="space-y-6 relative">
          <!-- Timeline line -->
          <div
            class="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-500/50 via-accent-500/30 to-transparent hidden md:block"
          ></div>

          <Card
            v-for="item in roadmap"
            :key="item.title"
            class="p-8 border-white/10 hover:border-primary-500/30 transition-all relative"
          >
            <div class="flex gap-6 items-start">
              <div class="shrink-0">
                <div
                  class="w-16 h-16 rounded-full bg-bg-surface border-2 border-primary-500/30 flex items-center justify-center relative z-10"
                >
                  <span class="text-sm font-bold text-primary-400">{{
                    item.quarter
                  }}</span>
                </div>
              </div>
              <div class="flex-1">
                <h3 class="text-2xl font-bold mb-3">{{ item.title }}</h3>
                <p class="text-content-muted leading-relaxed">
                  {{ item.description }}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div class="text-center mt-12">
          <Button to="/feature-request" :as="NuxtLink">前往完整路线图</Button>
        </div>
      </div>
    </section>

    <!-- Join Us -->
    <section class="py-20">
      <div class="container mx-auto px-4">
        <div
          class="relative rounded-3xl bg-gradient-to-br from-primary-900/20 to-accent-900/20 border border-white/10 p-12 md:p-16 overflow-hidden"
        >
          <div
            class="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"
          ></div>
          <div class="relative z-10 max-w-3xl mx-auto text-center">
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6"
            >
              <span
                class="text-sm font-medium text-accent-400 tracking-wider uppercase"
                >Join us</span
              >
            </div>
            <h2 class="text-3xl md:text-4xl font-bold mb-6">
              与我们一起定义下一代知识工具
            </h2>
            <p class="text-content-muted mb-10 text-lg leading-relaxed">
              正在寻找对浏览器扩展、AI、云边计算充满热情的合作者。欢迎在 GitHub
              发起 Issue 或发送邮件介绍你的想法。
            </p>
            <div class="flex flex-col sm:flex-row justify-center gap-4">
              <Button
                href="https://github.com/ChenQiWen/acuityBookmarks"
                target="_blank"
                :as="'a'"
              >
                <Github class="w-4 h-4 mr-2" />
                访问 GitHub
              </Button>
              <Button variant="secondary" to="/contact" :as="NuxtLink"
                >联系团队</Button
              >
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
