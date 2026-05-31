<script setup lang="ts">
import { Brain, Zap, Layout, Bot, Lock, Share2, Check, Github } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'

const NuxtLink = resolveComponent('NuxtLink')

const highlights = [
  {
    tag: 'AI 语义',
    title: '向量推荐可解释',
    description: '所有推荐来源可追溯，可一键查看 Summary 与 Embedding。'
  },
  {
    tag: '离线优先',
    title: '无网也能管理',
    description: '索引、摘要、操作全部在本地执行，恢复网络后再统一同步。'
  },
  {
    tag: '自动化',
    title: '失效检测',
    description: '自动检测书签链接是否失效，及时发现无法访问的网页。'
  }
]

const modules = [
  {
    lucideIcon: Brain,
    title: 'AI 语义引擎',
    description: '本地生成摘要与 embedding，结合 Worker 推理返回推荐。',
    points: ['支持自定义 Prompt', '可选自托管模型', '推荐记录可回放']
  },
  {
    lucideIcon: Zap,
    title: '多索引检索',
    description: 'Fuse.js + 标签过滤 + 备注全文检索，匹配权重可调。',
    points: ['拼写容错 / 多语言', '按权重分段显示', '快捷键一键过滤']
  },
  {
    lucideIcon: Layout,
    title: '分层工作台',
    description: 'Popup、管理台、侧边栏共享状态，响应式布局无缝切换。',
    points: ['虚拟滚动 20K+ 列表', '批量拖拽 + 多选', 'Pinia Store 持久化']
  },
  {
    lucideIcon: Bot,
    title: '失效检测',
    description: '自动检测书签链接的 HTTP 状态，及时发现失效链接。',
    points: ['批量检测', '状态码识别', '失败自动重试']
  },
  {
    lucideIcon: Lock,
    title: '隐私与同步',
    description: 'Chrome storage + Supabase 双写，配合 RLS 控制访问。',
    points: ['数据加密传输', '可选自托管 Worker', '变更日志可审计']
  },
  {
    lucideIcon: Share2,
    title: '开放接口',
    description: 'tRPC API + Router，可接入自定义工作流或知识库。',
    points: ['Webhook/事件总线', '命令面板扩展', 'Chrome Message Bridge']
  }
]

const flows = [
  {
    step: '01',
    title: '采集与理解',
    description: '书签保存 -> 本地生成摘要/embedding -> 入库 IndexedDB。',
    detail: '可配置语言、摘要长度、忽略域名等参数。'
  },
  {
    step: '02',
    title: 'Worker 推理',
    description: '向 Cloudflare Worker 请求推荐，并在 Supabase 记录审计。',
    detail: '全程加密，支持切换到私有接口。'
  },
  {
    step: '03',
    title: '失效检测',
    description: '自动检测书签链接的 HTTP 状态，及时发现失效链接。',
    detail: '批量检测，失败任务自动重试，避免误报。'
  }
]

const views = [
  {
    tag: 'Popup',
    title: '即时搜索器',
    mode: '快速入口',
    description: '⌘B/Alt+B 唤起，输入即得推荐，适合写作/研究即时引用。',
    points: ['键盘优先交互', 'AI 推荐卡片', '快捷操作书签']
  },
  {
    tag: 'Management',
    title: '分层工作区',
    mode: '批量整理',
    description: '支持看板/表格/列表多视图，自定义分组策略满足团队协作。',
    points: ['虚拟滚动', '批量拖拽', '自定义字段']
  },
  {
    tag: 'Side Panel',
    title: '上下文助手',
    mode: '辅助研究',
    description: '在阅读页面时，侧边栏自动推荐关联书签，提供智能摘要。',
    points: ['与页面内容联动', '快速收藏/标注', '支持插件生态']
  }
]

useSeoMeta({
  title: '功能特性 - otterSage',
  description:
    '了解 otterSage 六大模块：AI 语义引擎、多索引检索、分层工作台、失效检测、同步安全与开放接口。'
})
</script>

<template>
  <div class="min-h-screen pb-20">
    <!-- Hero Section -->
    <section class="relative pt-20 pb-12 overflow-hidden">
      <div
        class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-primary-500/10 blur-[100px] -z-10"
      ></div>

      <div class="container mx-auto px-4 text-center">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-5"
        >
          <span class="text-xs font-medium text-primary-400 tracking-wider uppercase"
            >Product Features</span
          >
        </div>

        <h1 class="text-3xl md:text-5xl font-bold tracking-tight mb-4">
          一站式书签操作系统<br />
          <span
            class="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400"
            >6 大能力模块，按需组合</span
          >
        </h1>

        <p class="text-base md:text-lg text-content-muted max-w-2xl mx-auto mb-8 leading-relaxed">
          从本地检索、AI 推荐到失效书签检测，每个模块可独立启用，也能组合成完整知识工作流。
        </p>

        <div class="flex justify-center gap-3">
          <Button to="/download" :as="NuxtLink">免费安装</Button>
          <Button variant="secondary" to="/pricing" :as="NuxtLink">查看方案</Button>
        </div>
      </div>
    </section>

    <!-- Highlights -->
    <section class="py-8">
      <div class="container mx-auto px-4">
        <h2 class="sr-only">核心亮点</h2>
        <div class="highlights-grid">
          <Card
            v-for="highlight in highlights"
            :key="highlight.title"
            class="p-5 border-white/5 bg-white/[0.02]"
          >
            <div class="text-primary-400 text-xs font-bold uppercase tracking-widest mb-1.5">
              {{ highlight.tag }}
            </div>
            <div class="text-base font-bold mb-1.5">{{ highlight.title }}</div>
            <p class="text-content-muted text-sm leading-relaxed">
              {{ highlight.description }}
            </p>
          </Card>
        </div>
      </div>
    </section>

    <!-- Modules Section -->
    <section class="py-16">
      <div class="container mx-auto px-4">
        <div class="mb-10 max-w-2xl">
          <div class="text-accent-400 text-xs font-bold uppercase tracking-widest mb-2">
            核心模块
          </div>
          <h2 class="text-2xl md:text-3xl font-bold mb-3">六大模块覆盖日常高频动作</h2>
          <p class="text-content-muted">所有模块基于统一 API / Store，可按需组合或单独启用。</p>
        </div>

        <div class="modules-grid">
          <Card
            v-for="module in modules"
            :key="module.title"
            class="p-6 hover:border-primary-500/30 transition-colors group"
            variant="glass"
          >
            <div
              class="w-10 h-10 rounded-lg bg-bg-surface border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300"
            >
              <component :is="module.lucideIcon" class="w-5 h-5 text-primary-400" />
            </div>
            <h3 class="text-base font-bold mb-2">{{ module.title }}</h3>
            <p class="text-content-muted text-sm mb-4 leading-relaxed">
              {{ module.description }}
            </p>
            <ul class="space-y-1.5">
              <li
                v-for="point in module.points"
                :key="point"
                class="flex items-start text-xs text-content-subtle"
              >
                <Check class="w-3.5 h-3.5 text-accent-400 mr-1.5 shrink-0 mt-0.5" />
                <span>{{ point }}</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </section>

    <!-- AI Flow Section -->
    <section class="py-16 bg-white/[0.02] border-y border-white/5">
      <div class="container mx-auto px-4">
        <div class="text-center mb-10 max-w-2xl mx-auto">
          <div class="text-primary-400 text-xs font-bold uppercase tracking-widest mb-2">
            AI × 自动化
          </div>
          <h2 class="text-2xl md:text-3xl font-bold mb-3">AI 语义理解 + 失效书签检测</h2>
          <p class="text-content-muted">构成真正可控的智能体验，全流程透明可见。</p>
        </div>

        <div class="flows-grid relative">
          <div
            class="hidden md:block absolute top-10 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-primary-500/0 via-primary-500/20 to-primary-500/0 border-t border-dashed border-primary-500/30 z-0"
          ></div>

          <div v-for="flow in flows" :key="flow.title" class="relative z-10">
            <Card class="p-6 h-full bg-bg-default border-white/10">
              <div
                class="w-8 h-8 rounded-full bg-bg-surface border border-primary-500/20 text-primary-400 flex items-center justify-center font-bold text-sm mb-4 shadow-lg shadow-primary-500/5 mx-auto md:mx-0"
              >
                {{ flow.step }}
              </div>
              <h3 class="text-base font-bold mb-2 text-center md:text-left">
                {{ flow.title }}
              </h3>
              <p class="text-content-muted text-sm mb-3 text-center md:text-left leading-relaxed">
                {{ flow.description }}
              </p>
              <div
                class="p-2.5 rounded bg-bg-surface/50 text-xs text-content-subtle border border-white/5 leading-relaxed"
              >
                {{ flow.detail }}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>

    <!-- Views Showcase -->
    <section class="py-16">
      <div class="container mx-auto px-4">
        <div class="mb-10 max-w-2xl">
          <div class="text-accent-400 text-xs font-bold uppercase tracking-widest mb-2">
            体验视图
          </div>
          <h2 class="text-2xl md:text-3xl font-bold mb-3">三套界面协同</h2>
          <p class="text-content-muted">同一套数据模型，针对不同场景提供最快捷的操作。</p>
        </div>

        <div class="views-grid">
          <Card
            v-for="view in views"
            :key="view.title"
            class="flex flex-col overflow-hidden border-white/10"
          >
            <div class="p-1 bg-white/5 border-b border-white/5 flex items-center gap-1.5 px-3 h-7">
              <div class="w-2 h-2 rounded-full bg-red-500/30"></div>
              <div class="w-2 h-2 rounded-full bg-yellow-500/30"></div>
              <div class="w-2 h-2 rounded-full bg-green-500/30"></div>
            </div>
            <div class="p-6 flex-1 flex flex-col">
              <div class="flex justify-between items-start mb-3">
                <div>
                  <div class="text-xs font-bold text-primary-400 uppercase tracking-wider mb-1">
                    {{ view.tag }}
                  </div>
                  <h3 class="text-lg font-bold">{{ view.title }}</h3>
                </div>
                <Badge variant="outline" class="text-xs">{{ view.mode }}</Badge>
              </div>
              <p class="text-content-muted text-sm mb-4 flex-1 leading-relaxed">
                {{ view.description }}
              </p>
              <ul class="space-y-1.5 mt-auto">
                <li
                  v-for="item in view.points"
                  :key="item"
                  class="flex items-center text-xs text-content-subtle"
                >
                  <div class="w-1 h-1 rounded-full bg-accent-500 mr-2 shrink-0"></div>
                  {{ item }}
                </li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </section>

    <!-- Closing -->
    <section class="py-14">
      <div class="container mx-auto px-4">
        <div
          class="relative rounded-2xl bg-gradient-to-br from-primary-900/20 to-accent-900/20 border border-white/10 p-10 text-center overflow-hidden"
        >
          <div class="relative z-10 max-w-xl mx-auto">
            <h2 class="text-2xl font-bold mb-4">每周功能增量，路线图公开透明</h2>
            <p class="text-content-muted mb-6 text-sm leading-relaxed">
              访问路线图为新功能投票，或加入 GitHub 直接贡献。你的反馈是我们演进的主要驱动力。
            </p>
            <div class="flex justify-center gap-3">
              <Button to="/feature-request" :as="NuxtLink">查看路线图</Button>
              <Button
                variant="outline"
                href="https://github.com/ChenQiWen/otterSage"
                target="_blank"
                :as="'a'"
              >
                <Github class="w-4 h-4 mr-2" />
                GitHub
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.highlights-grid,
.flows-grid,
.views-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, 1fr);
}

.modules-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, 1fr);
}

@media (width <= 900px) {
  .modules-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (width <= 600px) {
  .highlights-grid,
  .modules-grid,
  .flows-grid,
  .views-grid {
    grid-template-columns: 1fr;
  }
}
</style>
