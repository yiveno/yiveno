<script setup lang="ts">
import { Download, Code, Check, Chrome, HardDrive } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'

const NuxtLink = resolveComponent('NuxtLink')
const { extensionLink } = useProductLinks()

const builds = [
  {
    tag: 'Stable',
    title: '正式版',
    description: '经过完整 QA 与 Store 审核，适合生产环境。',
    notes: ['自动更新', '包含最新 AI 功能', '支持 Chrome / Edge'],
    linkLabel: '前往商店',
    link: extensionLink,
    external: true
  },
  {
    tag: 'Beta',
    title: '内测版',
    description: '提前体验即将发布的能力，适合愿意反馈问题的用户。',
    notes: ['每周一次', '内置调试日志', '可能含实验特性'],
    linkLabel: '查看路线图',
    link: '/feature-request',
    external: false
  },
  {
    tag: 'Source',
    title: '自行构建',
    description: 'Fork 项目或从 Release 下载 zip，完全掌控环境。',
    notes: ['遵循 MIT 许可', '支持 Cloudflare Worker 自托管', '欢迎提交 PR'],
    linkLabel: 'GitHub Releases',
    link: 'https://github.com/ChenQiWen/otterSage',
    external: true
  }
]

useSeoMeta({
  title: '下载 - otterSage',
  description: '通过 Chrome Web Store 或本地构建方式安装 otterSage。'
})
</script>

<template>
  <div class="min-h-screen pb-20">
    <!-- Hero Section -->
    <section class="relative pt-32 pb-20 overflow-hidden">
      <div
        class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary-500/10 blur-[120px] -z-10"
      ></div>

      <div class="container mx-auto px-4">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6"
            >
              <span class="text-sm font-medium text-primary-400 tracking-wider uppercase"
                >Download</span
              >
            </div>

            <h1 class="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
              立即安装<br />
              <span
                class="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400"
                >otterSage</span
              ><br />
              开启智能书签体验
            </h1>

            <p class="text-lg text-content-muted leading-relaxed mb-8">
              Chrome、Edge 直接安装。开发者也可本地加载 dist/ 目录，或自定义打包。
            </p>

            <div class="flex flex-col sm:flex-row gap-4">
              <Button size="lg" :href="extensionLink" target="_blank" :as="'a'">
                <Download class="w-5 h-5 mr-2" />
                Chrome Web Store
              </Button>
              <Button variant="secondary" size="lg" to="/features" :as="NuxtLink">查看功能</Button>
            </div>
          </div>

          <Card class="p-8 border-white/10 bg-bg-surface/60">
            <h2 class="text-xl font-bold mb-6 flex items-center">
              <Code class="w-5 h-5 mr-2 text-primary-400" />
              手动安装（开发者/内测）
            </h2>
            <ol class="space-y-4 text-content-muted">
              <li class="flex gap-3">
                <span
                  class="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold"
                  >1</span
                >
                <span
                  >在仓库根目录运行
                  <code class="px-2 py-1 bg-bg-depth rounded text-sm text-accent-400"
                    >bun run build:frontend</code
                  ></span
                >
              </li>
              <li class="flex gap-3">
                <span
                  class="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold"
                  >2</span
                >
                <span
                  >打开
                  <code class="px-2 py-1 bg-bg-depth rounded text-sm text-accent-400"
                    >chrome://extensions</code
                  >，开启开发者模式</span
                >
              </li>
              <li class="flex gap-3">
                <span
                  class="flex-shrink-0 w-6 h-6 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-sm font-bold"
                  >3</span
                >
                <span
                  >点击"加载已解压的扩展程序"，选择
                  <code class="px-2 py-1 bg-bg-depth rounded text-sm text-accent-400"
                    >dist/</code
                  ></span
                >
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </section>

    <!-- Release Channels -->
    <section class="py-24 bg-white/[0.02] border-y border-white/5">
      <div class="container mx-auto px-4">
        <div class="text-center mb-16 max-w-3xl mx-auto">
          <div class="text-accent-400 text-sm font-bold uppercase tracking-widest mb-2">
            Release channels
          </div>
          <h2 class="text-3xl md:text-4xl font-bold mb-4">多通道让你按需选择稳定或前沿版本</h2>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card
            v-for="build in builds"
            :key="build.title"
            class="p-8 border-white/10 hover:border-primary-500/30 transition-colors flex flex-col"
          >
            <Badge
              :variant="build.tag === 'Stable' ? 'default' : 'outline'"
              class="self-start mb-4"
              >{{ build.tag }}</Badge
            >
            <h3 class="text-2xl font-bold mb-3">{{ build.title }}</h3>
            <p class="text-content-muted mb-6 flex-1">
              {{ build.description }}
            </p>
            <ul class="space-y-2 mb-8">
              <li
                v-for="item in build.notes"
                :key="item"
                class="flex items-start text-sm text-content-subtle"
              >
                <Check class="w-4 h-4 text-accent-400 mr-2 shrink-0 mt-0.5" />
                <span>{{ item }}</span>
              </li>
            </ul>
            <Button
              :variant="build.tag === 'Stable' ? 'primary' : 'outline'"
              block
              :href="build.external ? build.link : undefined"
              :to="build.external ? undefined : build.link"
              :target="build.external ? '_blank' : undefined"
              :as="build.external ? 'a' : NuxtLink"
            >
              {{ build.linkLabel }}
            </Button>
          </Card>
        </div>
      </div>
    </section>

    <!-- System Requirements -->
    <section class="py-20">
      <div class="container mx-auto px-4 max-w-4xl">
        <div class="text-center mb-12">
          <h2 class="text-2xl font-bold mb-4">系统要求</h2>
          <p class="text-content-muted">确保您的浏览器满足以下最低要求</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card class="p-6 border-white/10">
            <div class="flex items-start gap-4">
              <div
                class="w-12 h-12 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0"
              >
                <Chrome class="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h3 class="font-bold mb-2">Chrome / Edge</h3>
                <p class="text-sm text-content-muted">版本 100+ (推荐最新版本)</p>
              </div>
            </div>
          </Card>

          <Card class="p-6 border-white/10">
            <div class="flex items-start gap-4">
              <div
                class="w-12 h-12 rounded-lg bg-accent-500/10 flex items-center justify-center shrink-0"
              >
                <HardDrive class="w-6 h-6 text-accent-400" />
              </div>
              <div>
                <h3 class="font-bold mb-2">存储空间</h3>
                <p class="text-sm text-content-muted">至少 50MB 可用空间</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  </div>
</template>
