<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
import Button from '@/components/ui/Button.vue'

const NuxtLink = resolveComponent('NuxtLink')

const freeFeatures = ['无限书签与标签', '失效书签检测', 'Popup / Side Panel 全量能力']

const proFeatures = [
  '包含所有免费功能',
  'AI 向量推荐 + 摘要',
  '多设备 Supabase 同步',
  '自定义自动化与监控',
  '优先支持渠道'
]

const teamFeatures = [
  '单点登录 & 权限控制',
  '私有 Worker / VPC 部署',
  '专属成功经理',
  '安全审计与培训'
]
</script>

<template>
  <section id="pricing" class="py-16 relative">
    <div class="container mx-auto px-4">
      <div class="text-center max-w-2xl mx-auto mb-10">
        <h2 class="text-2xl md:text-3xl font-bold mb-3">
          简单透明的<span class="text-primary-400">定价方案</span>
        </h2>
        <p class="text-content-muted text-sm">免费即可使用核心功能，按需升级高级能力。</p>
      </div>

      <div class="pricing-grid">
        <!-- Free Plan -->
        <Card class="p-6 flex flex-col">
          <div class="mb-5">
            <h3 class="text-sm font-medium text-content-muted mb-1">个人 · Free</h3>
            <div class="mt-1 text-2xl font-bold">免费</div>
            <p class="mt-1.5 text-xs text-content-subtle leading-relaxed">
              核心检索、离线缓存、基础自动化。
            </p>
          </div>
          <ul class="space-y-2.5 mb-6 flex-1">
            <li v-for="feature in freeFeatures" :key="feature" class="flex items-start">
              <Check class="w-4 h-4 text-primary-400 mr-2 shrink-0 mt-0.5" />
              <span class="text-xs text-content-muted">{{ feature }}</span>
            </li>
          </ul>
          <Button variant="outline" block to="/download" :as="NuxtLink" class="text-sm"
            >立即下载</Button
          >
        </Card>

        <!-- Pro Plan -->
        <Card class="p-6 flex flex-col relative border-primary-500/50 bg-bg-surface/80" hover>
          <div class="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge variant="default" class="bg-primary-500 text-white border-none text-xs px-3"
              >最受欢迎</Badge
            >
          </div>
          <div class="mb-5">
            <h3 class="text-sm font-medium text-primary-400 mb-1">Pro</h3>
            <div class="mt-1 flex items-baseline text-2xl font-bold">
              ¥49
              <span class="text-xs font-normal text-content-muted ml-1">/ 月</span>
            </div>
            <p class="mt-1.5 text-xs text-content-subtle leading-relaxed">
              解锁 AI 推荐、批量同步与优先支持。
            </p>
          </div>
          <ul class="space-y-2.5 mb-6 flex-1">
            <li v-for="feature in proFeatures" :key="feature" class="flex items-start">
              <Check class="w-4 h-4 text-primary-400 mr-2 shrink-0 mt-0.5" />
              <span class="text-xs text-content">{{ feature }}</span>
            </li>
          </ul>
          <Button variant="primary" block to="/pricing" :as="NuxtLink" class="text-sm"
            >升级到 Pro</Button
          >
        </Card>

        <!-- Team Plan -->
        <Card class="p-6 flex flex-col">
          <div class="mb-5">
            <h3 class="text-sm font-medium text-content-muted mb-1">Team</h3>
            <div class="mt-1 text-2xl font-bold">定制</div>
            <p class="mt-1.5 text-xs text-content-subtle leading-relaxed">
              面向团队的集中管理与私有化部署。
            </p>
          </div>
          <ul class="space-y-2.5 mb-6 flex-1">
            <li v-for="feature in teamFeatures" :key="feature" class="flex items-start">
              <Check class="w-4 h-4 text-content-subtle mr-2 shrink-0 mt-0.5" />
              <span class="text-xs text-content-muted">{{ feature }}</span>
            </li>
          </ul>
          <Button variant="ghost" block to="/contact" :as="NuxtLink" class="text-sm"
            >联系销售</Button
          >
        </Card>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pricing-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 960px;
  margin: 0 auto;
}

@media (width <= 768px) {
  .pricing-grid {
    grid-template-columns: 1fr;
  }
}
</style>
