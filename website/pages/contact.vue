<script setup lang="ts">
import { Mail, MessageSquare, TrendingUp, ChevronDown } from 'lucide-vue-next'
import Card from '@/components/ui/Card.vue'
import ContactForm from '@/components/ContactForm.vue'

const contacts = [
  {
    icon: Mail,
    label: '邮箱',
    value: 'hi@acuitybookmarks.com',
    description: '适用于合作、媒体采访、企业采购相关事宜'
  },
  {
    icon: MessageSquare,
    label: '社区',
    value: 'Discord / GitHub',
    description: '在 issue 或讨论区提需求、提交 PR'
  },
  {
    icon: TrendingUp,
    label: '反馈通道',
    value: 'feature-request',
    description: '直接在路线图页面投票或添加需求'
  }
]

const faqs = [
  {
    q: '多久能得到回复？',
    a: '工作日 24h 内、周末 48h 内回复。Pro/Team 用户会优先处理。'
  },
  {
    q: '是否提供在线演示？',
    a: '可以，Team/Enterprise 用户可预约线上 Demo，我们会展示完整部署流程。'
  }
]

useSeoMeta({
  title: '联系我们 - AcuityBookmarks',
  description:
    '通过邮件、社区或表单联系 AcuityBookmarks 团队，反馈问题或探讨合作。'
})
</script>

<template>
  <div class="min-h-screen pb-20">
    <!-- Hero Section -->
    <section class="relative pt-32 pb-20 overflow-hidden">
      <div
        class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary-500/10 blur-[120px] -z-10"
      ></div>

      <div class="container mx-auto px-4 text-center max-w-4xl">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6"
        >
          <span
            class="text-sm font-medium text-primary-400 tracking-wider uppercase"
            >Contact us</span
          >
        </div>

        <h1 class="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          我们在听，欢迎你与<br />
          <span
            class="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400"
            >产品、技术团队直接对话</span
          >
        </h1>

        <p
          class="text-lg md:text-xl text-content-muted max-w-3xl mx-auto leading-relaxed"
        >
          无论是合作、企业部署、Bug
          反馈还是功能建议，都可以通过下方渠道联系。我们会在 24-48h 内回复。
        </p>
      </div>
    </section>

    <!-- Contact Methods -->
    <section class="py-10">
      <div class="container mx-auto px-4 max-w-5xl">
        <h2 class="sr-only">联系方式</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <Card
            v-for="item in contacts"
            :key="item.label"
            class="p-8 text-center border-white/10 hover:border-primary-500/30 transition-colors group"
          >
            <div
              class="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform"
            >
              <component :is="item.icon" class="w-8 h-8 text-primary-400" />
            </div>
            <div
              class="text-xs font-bold text-primary-400 uppercase tracking-wider mb-2"
            >
              {{ item.label }}
            </div>
            <h3 class="text-xl font-bold mb-3">{{ item.value }}</h3>
            <p class="text-content-muted text-sm">{{ item.description }}</p>
          </Card>
        </div>
      </div>
    </section>

    <!-- Contact Form -->
    <section class="py-10">
      <div class="container mx-auto px-4 max-w-2xl">
        <Card class="p-10 border-white/10">
          <div class="mb-8 text-center">
            <h2 class="text-2xl font-bold mb-3">发送消息</h2>
            <p class="text-content-muted">
              填写表单后我们会通过邮件回复，若你愿意也可附上 GitHub/Slack 信息。
            </p>
          </div>
          <ContactForm />
        </Card>
      </div>
    </section>

    <!-- FAQ Section -->
    <section class="py-20 bg-white/[0.02] border-y border-white/5">
      <div class="container mx-auto px-4 max-w-3xl">
        <div class="text-center mb-12">
          <h2 class="text-2xl font-bold mb-4">常见问题</h2>
          <p class="text-content-muted">联系前你可能想了解</p>
        </div>

        <div class="space-y-4">
          <div
            v-for="item in faqs"
            :key="item.q"
            class="border border-white/10 rounded-xl bg-bg-surface overflow-hidden"
          >
            <details class="group">
              <summary
                class="flex justify-between items-center p-6 cursor-pointer list-none"
              >
                <span class="font-bold text-lg">{{ item.q }}</span>
                <ChevronDown
                  class="w-5 h-5 text-content-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <div
                class="px-6 pb-6 text-content-muted leading-relaxed border-t border-white/5 pt-4"
              >
                {{ item.a }}
              </div>
            </details>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
