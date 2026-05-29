<script setup lang="ts">
import { X, ArrowRight } from 'lucide-vue-next'

const painPoints = [
  {
    title: '搜索慢且无序',
    description: '默认书签管理缺乏模糊匹配与分层视图，大量收藏后几乎无法回忆。',
    solution: '多索引引擎：Fuse.js + 语义向量 + 标签过滤，一次输入获取上下文结果。'
  },
  {
    title: '同步易丢失',
    description: '浏览器同步经常冲突，团队无法共享最新的工作台与知识结构。',
    solution: 'Chrome storage + Supabase 双写，变更日志可回放，跨设备实时一致。'
  },
  {
    title: '没有推荐与提醒',
    description: '收藏只是起点，真正的难题在于何时、在何种场景提醒你使用。',
    solution: '本地 AI Agent 理解书签语义，结合上下文推荐最合适的链接。'
  }
]
</script>

<template>
  <section class="py-16 bg-bg-surface/30 border-y border-white/5">
    <div class="container mx-auto px-4">
      <div class="painpoints-grid">
        <div class="md:col-span-1 painpoints-left">
          <p class="text-accent-400 text-xs tracking-widest uppercase mb-3 font-bold">真实痛点</p>
          <h2 class="text-2xl font-bold mb-4 leading-tight">我们解决最难啃的问题</h2>
          <p class="text-content-muted text-sm leading-relaxed">
            设计 AcuityBookmarks
            的初衷，就是解决「书签堆成山却找不到」、「跨设备无法同步」等长期痛点。
          </p>
        </div>

        <div class="md:col-span-2 painpoints-right grid gap-5">
          <div v-for="pain in painPoints" :key="pain.title" class="flex gap-3">
            <div
              class="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5"
            >
              <X class="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h3 class="text-sm font-bold mb-1">{{ pain.title }}</h3>
              <p class="text-content-muted text-sm mb-2 leading-relaxed">{{ pain.description }}</p>
              <div class="flex items-center text-primary-400 text-xs">
                <ArrowRight class="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span>{{ pain.solution }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.painpoints-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 32px;
  align-items: start;
}

@media (width <= 768px) {
  .painpoints-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
</style>
