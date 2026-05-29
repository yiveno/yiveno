<script setup lang="ts">
import { Zap, Brain, ShieldCheck, RefreshCw, Lock } from 'lucide-vue-next'
import Card from '@/components/ui/Card.vue'
import Badge from '@/components/ui/Badge.vue'
</script>

<template>
  <section id="features" class="py-16 relative">
    <div class="container mx-auto px-4">
      <div class="text-center max-w-2xl mx-auto mb-10">
        <h2 class="text-2xl md:text-3xl font-bold mb-3">
          全能工具箱，<span class="text-primary-400">为效率而生</span>
        </h2>
        <p class="text-content-muted text-sm leading-relaxed">
          分层架构保证每个能力模块既可独立启用、也能组合成流畅的知识工作流。
        </p>
      </div>

      <div class="features-bento">
        <!-- Feature 1: Fast Search (Large) -->
        <Card
          class="features-bento__wide p-6 relative group overflow-hidden min-h-[220px] flex flex-col justify-between"
        >
          <div class="relative z-10">
            <div
              class="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center mb-4 text-primary-400"
            >
              <Zap class="w-5 h-5" />
            </div>
            <h3 class="text-lg font-bold mb-2">极速检索，毫秒级响应</h3>
            <p class="text-content-muted text-sm leading-relaxed max-w-md">
              多引擎并行架构：关键词、模糊匹配、向量语义同步返回。20K+ 书签也能瞬间定位。
            </p>
            <div class="mt-4 flex gap-2 flex-wrap">
              <Badge variant="outline" class="text-xs">Fuse.js</Badge>
              <Badge variant="outline" class="text-xs">语义向量</Badge>
              <Badge variant="outline" class="text-xs">拼写容错</Badge>
            </div>
          </div>
          <div
            class="absolute right-0 bottom-0 w-1/2 h-full bg-gradient-to-l from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          ></div>
        </Card>

        <!-- Feature 2: AI Recommendation -->
        <Card class="p-6 flex flex-col h-full relative group">
          <div
            class="w-10 h-10 bg-accent-500/20 rounded-lg flex items-center justify-center mb-4 text-accent-400"
          >
            <Brain class="w-5 h-5" />
          </div>
          <h3 class="text-base font-bold mb-2">本地 AI 智能推荐</h3>
          <p class="text-content-muted text-sm leading-relaxed mb-4">
            基于 embedding 的上下文推送，自动生成书签摘要与主题。
          </p>
          <div class="mt-auto pt-3 border-t border-white/5">
            <div class="text-xs text-content-subtle flex items-center">
              <Lock class="w-3 h-3 mr-1 shrink-0" /> 数据完全本地处理
            </div>
          </div>
        </Card>

        <!-- Feature 3: Privacy -->
        <Card class="p-6 flex flex-col h-full">
          <div
            class="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-4 text-green-400"
          >
            <ShieldCheck class="w-5 h-5" />
          </div>
          <h3 class="text-base font-bold mb-2">隐私优先设计</h3>
          <p class="text-content-muted text-sm leading-relaxed">
            核心索引存储在 Chrome storage + IndexedDB，永不离开本机。
          </p>
        </Card>

        <!-- Feature 4: Sync (Large) -->
        <Card class="features-bento__wide p-6 relative overflow-hidden min-h-[220px]">
          <div class="sync-inner relative z-10">
            <div>
              <div
                class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4 text-blue-400"
              >
                <RefreshCw class="w-5 h-5" />
              </div>
              <h3 class="text-lg font-bold mb-2">多端实时同步</h3>
              <p class="text-content-muted text-sm leading-relaxed mb-4">
                Chrome storage + Supabase 双写，变更日志可回放，跨设备实时一致。
              </p>
              <Badge variant="default" class="text-xs">Cloudflare Worker</Badge>
            </div>
            <div class="bg-bg-depth/50 rounded-lg p-4 border border-white/5 min-h-[120px]">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                  <span class="text-xs text-content-subtle">Sync Active</span>
                </div>
                <span class="text-xs text-content-muted">Just now</span>
              </div>
              <div class="space-y-2">
                <div class="h-1.5 bg-white/10 rounded w-3/4"></div>
                <div class="h-1.5 bg-white/10 rounded w-1/2"></div>
                <div class="h-1.5 bg-white/10 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Bento grid: 3 columns, wide cards span 2 */
.features-bento {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.features-bento__wide {
  grid-column: span 2;
}

.sync-inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: center;
  height: 100%;
}

@media (width <= 768px) {
  .features-bento {
    grid-template-columns: 1fr;
  }

  .features-bento__wide {
    grid-column: span 1;
  }

  .sync-inner {
    grid-template-columns: 1fr;
  }
}
</style>
