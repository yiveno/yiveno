<template>
  <div class="min-h-screen pb-20">
    <!-- Hero Section -->
    <section class="relative pt-20 pb-10 overflow-hidden">
      <div
        class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-primary-500/10 blur-[100px] -z-10"
      ></div>

      <div class="container mx-auto px-4 text-center">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-5"
        >
          <span
            class="text-xs font-medium text-primary-400 tracking-wider uppercase"
            >Pricing</span
          >
        </div>

        <h1 class="text-3xl md:text-5xl font-bold tracking-tight mb-4">
          免费入门 · 按需升级
        </h1>

        <p
          class="text-base text-content-muted max-w-xl mx-auto mb-8 leading-relaxed"
        >
          个人用户免费使用全部核心功能。Pro 解锁 AI 与云同步；Team 提供私有化部署与 SLA。
        </p>

        <div class="flex justify-center gap-6 text-sm">
          <div v-for="meta in metas" :key="meta.label" class="text-center">
            <div class="text-xl font-bold text-content mb-0.5">{{ meta.value }}</div>
            <div class="text-xs text-content-muted">{{ meta.label }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Plans Section -->
    <section class="py-8">
      <div class="container mx-auto px-4">
        <h2 class="sr-only">价格方案</h2>
        <div class="plans-grid">
          <!-- Free Plan -->
          <Card 
            class="p-6 flex flex-col h-full relative"
            :class="{
              'border-white/10': isPro || !isInitialized,
              'plan-card--current': !isPro && isInitialized
            }"
          >
            <!-- 当前方案徽章 -->
            <div v-if="!isPro && isInitialized" class="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge
                variant="default"
                class="bg-green-500 text-white border-none shadow-lg shadow-green-500/40 px-3 text-xs flex items-center gap-1.5"
              >
                <CheckCircle class="w-3.5 h-3.5" />
                <span>当前方案</span>
              </Badge>
            </div>
            
            <div class="mb-6">
              <div class="text-sm font-medium text-content-muted mb-1">Free</div>
              <div class="text-3xl font-bold mb-3">免费</div>
              <p class="text-xs text-content-subtle leading-relaxed">
                无限使用本地核心功能，完全离线可用。
              </p>
            </div>
            <Button
              variant="outline"
              block
              to="/download"
              :as="NuxtLink"
              class="mb-6"
              :disabled="!isPro && isInitialized"
            >
              {{ !isPro && isInitialized ? '已激活' : '立即下载' }}
            </Button>
            <ul class="space-y-3 flex-1">
              <li
                v-for="feature in plans[0]?.features"
                :key="feature"
                class="flex items-start text-sm text-content-muted"
              >
                <Check class="w-4 h-4 text-content-subtle mr-2.5 shrink-0 mt-0.5" />
                <span>{{ feature }}</span>
              </li>
            </ul>
          </Card>

          <!-- Pro Plan -->
          <Card
            class="p-6 flex flex-col h-full relative"
            :class="{
              'border-primary-500/50 bg-bg-surface/60 shadow-2xl shadow-primary-500/10': !isPro || !isInitialized,
              'plan-card--current plan-card--current-pro': isPro && isInitialized
            }"
            hover
          >
            <!-- 推荐徽章（非 PRO 用户显示） -->
            <div v-if="!isPro || !isInitialized" class="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge
                variant="default"
                class="bg-primary-500 text-white border-none shadow-lg shadow-primary-500/40 px-3 text-xs"
              >最受欢迎</Badge>
            </div>
            
            <!-- 当前方案徽章（PRO 用户显示） -->
            <div v-else class="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge
                variant="default"
                class="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black border-none shadow-lg shadow-yellow-500/40 px-3 text-xs font-semibold flex items-center gap-1.5"
              >
                <CheckCircle class="w-3.5 h-3.5" />
                <span>当前方案</span>
              </Badge>
            </div>
            
            <div class="mb-6">
              <div class="text-sm font-bold text-primary-400 mb-1">Pro</div>
              <div class="flex items-baseline gap-1 mb-1">
                <span class="text-3xl font-bold">¥49</span>
                <span class="text-content-muted text-sm">/ 月</span>
              </div>
              <p class="text-xs text-content-subtle mb-3">
                或 ¥499 / 年（省 15%）
              </p>
              <p class="text-xs text-content-muted leading-relaxed">
                面向专业用户的 AI + 同步 + 支持组合拳。
              </p>
            </div>
            <Button
              variant="primary"
              block
              :to="isPro && isInitialized ? '/account' : '/pricing'"
              :as="NuxtLink"
              class="mb-6"
              :disabled="isPro && isInitialized"
            >
              {{ isPro && isInitialized ? '已激活' : '升级到 Pro' }}
            </Button>
            <ul class="space-y-3 flex-1">
              <li
                v-for="feature in plans[1]?.features"
                :key="feature"
                class="flex items-start text-sm text-content"
              >
                <Check class="w-4 h-4 text-primary-400 mr-2.5 shrink-0 mt-0.5" />
                <span>{{ feature }}</span>
              </li>
            </ul>
          </Card>

          <!-- Team Plan -->
          <Card class="p-6 flex flex-col h-full border-white/10">
            <div class="mb-6">
              <div class="text-sm font-medium text-content-muted mb-1">Team</div>
              <div class="text-3xl font-bold mb-3">定制报价</div>
              <p class="text-xs text-content-subtle leading-relaxed">
                自托管 Worker、SSO、权限与审计全部打包。
              </p>
            </div>
            <Button
              variant="ghost"
              block
              to="/contact"
              :as="NuxtLink"
              class="mb-6"
              >联系销售</Button
            >
            <ul class="space-y-3 flex-1">
              <li
                v-for="feature in plans[2]?.features"
                :key="feature"
                class="flex items-start text-sm text-content-muted"
              >
                <Check class="w-4 h-4 text-content-subtle mr-2.5 shrink-0 mt-0.5" />
                <span>{{ feature }}</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </section>

    <!-- Comparison Table -->
    <section class="py-16">
      <div class="container mx-auto px-4 max-w-4xl">
        <div class="text-center mb-10">
          <h2 class="text-xl font-bold mb-2">功能详细对比</h2>
          <p class="text-content-muted text-sm">
            所有版本均支持离线、隐私优先；高级版拓展 AI 与团队能力
          </p>
        </div>

        <div class="overflow-x-auto">
          <div class="min-w-[560px]">
            <!-- Header -->
            <div
              class="grid grid-cols-4 gap-3 px-4 py-3 border-b border-white/10 font-semibold text-content-muted text-xs uppercase tracking-wider"
            >
              <div class="text-left">功能模块</div>
              <div class="text-center">Free</div>
              <div class="text-center text-primary-400">Pro</div>
              <div class="text-center">Team</div>
            </div>

            <!-- Rows -->
            <div
              v-for="(row) in matrix"
              :key="row.cap"
              class="grid grid-cols-4 gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors text-sm items-center"
            >
              <div class="font-medium text-sm">{{ row.cap }}</div>
              <div
                class="text-center text-sm"
                :class="row.free === '✓' ? 'text-green-400' : 'text-content-subtle'"
              >
                {{ row.free }}
              </div>
              <div
                class="text-center text-sm font-medium"
                :class="row.pro === '✓' ? 'text-primary-400' : 'text-content-muted'"
              >
                {{ row.pro }}
              </div>
              <div class="text-center text-sm text-content-subtle">{{ row.team }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section class="py-14 bg-white/[0.02] border-y border-white/5">
      <div class="container mx-auto px-4 max-w-2xl">
        <div class="text-center mb-8">
          <h2 class="text-xl font-bold mb-2">常见问题</h2>
          <p class="text-content-muted text-sm">关于价格、结算与部署的疑问</p>
        </div>

        <div class="space-y-3">
          <div
            v-for="item in faqs"
            :key="item.q"
            class="border border-white/10 rounded-xl bg-bg-surface overflow-hidden"
          >
            <details class="group">
              <summary
                class="flex justify-between items-center px-5 py-4 cursor-pointer list-none"
              >
                <span class="font-semibold text-sm">{{ item.q }}</span>
                <ChevronDown
                  class="w-4 h-4 text-content-muted transition-transform group-open:rotate-180 shrink-0 ml-3"
                />
              </summary>
              <div
                class="px-5 pb-4 text-content-muted text-sm leading-relaxed border-t border-white/5 pt-3"
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

<script setup lang="ts">
import { Check, ChevronDown, CheckCircle } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'

const NuxtLink = resolveComponent('NuxtLink')

// 获取用户订阅状态
const { isPro, isInitialized } = useSubscription()

const metas = [
  { value: '免费', label: '个人核心功能' },
  { value: '<48h', label: 'Pro 响应时间' },
  { value: 'SLA 99.9%', label: '企业稳定性' }
]

const plans = [
  {
    features: [
      '多索引检索、标签、备注',
      '失效书签检测',
      'Popup / Side Panel 全功能'
    ]
  },
  {
    features: [
      '包含 Free 所有功能',
      'AI 向量推荐 / 摘要',
      'Supabase 云同步',
      '批量自动化与监控',
      '优先支持渠道'
    ]
  },
  {
    features: [
      '私有 Cloudflare Worker',
      'Supabase RLS / SSO',
      '安全审计与培训',
      '专属成功经理'
    ]
  }
]

const matrix = [
  {
    cap: '离线本地功能',
    free: '✓',
    pro: '✓',
    team: '✓'
  },
  {
    cap: 'AI 推荐 / 摘要',
    free: '—',
    pro: '✓',
    team: '✓（可自托管）'
  },
  {
    cap: 'Supabase 同步',
    free: '—',
    pro: '✓',
    team: '✓ + RLS + SSO'
  },
  {
    cap: '自动化监控',
    free: '基础',
    pro: '高级调度',
    team: '自定义 Pipeline'
  },
  {
    cap: '支持与 SLA',
    free: '社区支持',
    pro: '<48h 邮件',
    team: 'SLA + 成功经理'
  }
]

const faqs = [
  {
    q: '购买 Pro 后可以取消吗？',
    a: '可以随时取消，周期结束前仍可使用。年度订阅支持按比例退款。您可以在账户设置中一键管理您的订阅状态。'
  },
  {
    q: '团队版如何部署？',
    a: '我们提供详细的部署脚本来检测环境，并协助将 Cloudflare Worker / Supabase 配置到您的账户。我们的技术团队会提供全程指导。'
  },
  {
    q: '是否支持企业采购流程？',
    a: '支持。我们可开具正规发票并签署数据处理协议（DPA）。请通过联系销售页面与我们取得联系，会有专人负责对接。'
  }
]

useSeoMeta({
  title: '定价 - AcuityBookmarks',
  description:
    '了解 Free、Pro、Team/Enterprise 三种方案，覆盖个人到团队的智能书签需求。'
})
</script>

<style scoped>
.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 960px;
  margin: 0 auto;
}

/* 当前方案高亮样式 - Free（绿色） */
.plan-card--current {
  border: 2px solid color-mix(in srgb, var(--acuity-semantic-success) 50%, transparent) !important;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--acuity-semantic-success) 8%, transparent) 0%,
    transparent 100%
  ) !important;
  box-shadow: 0 8px 24px color-mix(in srgb, var(--acuity-semantic-success) 15%, transparent) !important;
  animation: cardPulseGreen 3s ease-in-out infinite, cardFadeIn 0.6s ease-out;
}

/* 当前方案高亮样式 - Pro（金色） */
.plan-card--current-pro {
  border: 2px solid color-mix(in srgb, var(--acuity-accent-gold) 60%, transparent) !important;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--acuity-accent-gold) 10%, transparent) 0%,
    transparent 100%
  ) !important;
  box-shadow: 0 8px 32px color-mix(in srgb, var(--acuity-accent-gold) 25%, transparent) !important;
  animation: cardPulseGold 3s ease-in-out infinite, cardFadeIn 0.6s ease-out;
}

/* 卡片脉冲动画 - 绿色 */
@keyframes cardPulseGreen {
  0%, 100% {
    box-shadow: 0 8px 24px color-mix(in srgb, var(--acuity-semantic-success) 15%, transparent);
  }
  50% {
    box-shadow: 0 8px 32px color-mix(in srgb, var(--acuity-semantic-success) 30%, transparent), 
                0 0 0 4px color-mix(in srgb, var(--acuity-semantic-success) 10%, transparent);
  }
}

/* 卡片脉冲动画 - 金色 */
@keyframes cardPulseGold {
  0%, 100% {
    box-shadow: 0 8px 32px color-mix(in srgb, var(--acuity-accent-gold) 25%, transparent);
  }
  50% {
    box-shadow: 0 8px 40px color-mix(in srgb, var(--acuity-accent-gold) 40%, transparent), 
                0 0 0 4px color-mix(in srgb, var(--acuity-accent-gold) 15%, transparent);
  }
}

/* 卡片淡入动画 */
@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 徽章脉冲动画 - 应用到徽章元素 */
.plan-card--current :deep(.bg-green-500),
.plan-card--current-pro :deep(.bg-gradient-to-r) {
  animation: badgePulse 2s ease-in-out infinite;
}

@keyframes badgePulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* 悬停时暂停动画，增强交互感 */
.plan-card--current:hover,
.plan-card--current-pro:hover {
  animation-play-state: paused;
}

.plan-card--current:hover :deep(.bg-green-500),
.plan-card--current-pro:hover :deep(.bg-gradient-to-r) {
  animation-play-state: paused;
  transform: scale(1.05);
}

@media (max-width: 768px) {
  .plans-grid {
    grid-template-columns: 1fr;
  }
}

/* 减弱移动端动画，节省性能 */
@media (prefers-reduced-motion: reduce) {
  .plan-card--current,
  .plan-card--current-pro {
    animation: cardFadeIn 0.6s ease-out;
  }
  
  .plan-card--current :deep(.bg-green-500),
  .plan-card--current-pro :deep(.bg-gradient-to-r) {
    animation: none;
  }
}
</style>
