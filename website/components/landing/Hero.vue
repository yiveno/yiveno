<script setup lang="ts">
import { Sparkles, Chrome, PlayCircle, Zap, Brain } from 'lucide-vue-next'
import Button from '@/components/ui/Button.vue'

const props = defineProps<{
  extensionLink?: string
}>()

const NuxtLink = resolveComponent('NuxtLink')

const openExtension = () => {
  if (props.extensionLink) {
    window.open(props.extensionLink, '_blank')
  }
}
</script>

<template>
  <section class="relative pt-20 pb-16 overflow-hidden">
    <!-- Background decoration -->
    <div
      class="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] bg-hero-glow opacity-15 blur-[100px] -z-10"
    ></div>

    <div class="container mx-auto px-4 text-center relative z-10">
      <!-- Badge -->
      <div class="flex justify-center mb-5">
        <div
          class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md animate-fade-in"
        >
          <Sparkles class="w-3.5 h-3.5 text-accent-400" />
          <span class="text-xs font-medium text-primary-100 tracking-wide"
            >AI 驱动的智能书签工作台</span
          >
        </div>
      </div>

      <!-- Headline -->
      <h1
        class="text-4xl md:text-6xl font-bold tracking-tight mb-4 animate-slide-up"
        style="animation-delay: 100ms"
      >
        <span class="block text-content">让您的书签</span>
        <span
          class="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 via-accent-400 to-primary-400 animate-gradient-x"
        >
          井然有序，触手可及
        </span>
      </h1>

      <!-- Subtitle -->
      <p
        class="text-base md:text-lg text-content-muted max-w-xl mx-auto mb-8 animate-slide-up leading-relaxed"
        style="animation-delay: 200ms"
      >
        Fuse.js 模糊检索 × AI 语义推荐 × Cloudflare Worker，20K+ 书签毫秒级定位。
      </p>

      <!-- Actions -->
      <div
        class="flex flex-col sm:flex-row justify-center gap-3 mb-12 animate-slide-up"
        style="animation-delay: 300ms"
      >
        <Button size="lg" class="min-w-[160px] group" @click="openExtension">
          <Chrome class="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
          添加到 Chrome
        </Button>
        <Button variant="secondary" size="lg" class="min-w-[160px]" to="/features" :as="NuxtLink">
          <PlayCircle class="w-4 h-4 mr-2" />
          了解功能
        </Button>
      </div>

      <!-- Visual Placeholder/Showcase -->
      <div class="relative max-w-4xl mx-auto animate-slide-up" style="animation-delay: 400ms">
        <div
          class="relative rounded-xl bg-bg-surface border border-white/10 shadow-2xl shadow-primary-500/20 overflow-hidden aspect-[16/9] group"
        >
          <div
            class="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none z-10"
          ></div>
          <slot name="showcase">
            <div
              class="w-full h-full flex items-center justify-center bg-bg-depth text-content-muted"
            >
              <p>Dashboard Preview</p>
            </div>
          </slot>
        </div>

        <!-- Floating stats cards -->
        <div
          class="absolute -left-10 top-1/4 p-3 bg-bg-surface/90 backdrop-blur border border-white/10 rounded-lg shadow-xl hidden md:block animate-float-slow"
        >
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 bg-green-500/20 rounded-md">
              <Zap class="w-4 h-4 text-green-400" />
            </div>
            <div>
              <div class="text-[10px] text-content-muted">平均检索</div>
              <div class="text-sm font-bold text-content">&lt; 50ms</div>
            </div>
          </div>
        </div>

        <div
          class="absolute -right-6 bottom-1/3 p-3 bg-bg-surface/90 backdrop-blur border border-white/10 rounded-lg shadow-xl hidden md:block animate-float-slow"
          style="animation-delay: 1s"
        >
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 bg-accent-500/20 rounded-md">
              <Brain class="w-4 h-4 text-accent-400" />
            </div>
            <div>
              <div class="text-[10px] text-content-muted">AI 推荐准确率</div>
              <div class="text-sm font-bold text-content">92%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.animate-gradient-x {
  background-size: 200% 200%;
  animation: gradient-move 5s ease infinite;
}

@keyframes gradient-move {
  0% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}

.animate-float-slow {
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-20px);
  }

  100% {
    transform: translateY(0);
  }
}
</style>
