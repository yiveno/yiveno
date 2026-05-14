<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { LucideIcon } from '@/components'
import type { ChromeExtensionMessage } from '@/types/chrome-messages'

// --- 类型定义 ---
interface Step {
  id: string
  title: string
  subtitle?: string
  description?: string
  layout: 'centered' | 'split-left' | 'split-right'
  visualType: 'hero' | 'sync' | 'search' | 'privacy'
  actionText?: string
}

// --- 步骤配置 ---
const steps: Step[] = [
  {
    id: 'welcome',
    title: 'New Power-ups 11Unlocked',
    subtitle: 'Explore new features AcuityBookmarks brings to Chrome',
    layout: 'centered',
    visualType: 'hero'
  },
  {
    id: 'sync',
    title: 'Local-First Architecture',
    description: 'Your data never leaves your device. We are building a secure local index for instant access.',
    layout: 'split-left',
    visualType: 'sync'
  },
  {
    id: 'search',
    title: 'AI Semantic Search',
    description: 'Stop remembering exact keywords. Describe what you need, and our local AI will find it instantly.',
    layout: 'split-right',
    visualType: 'search',
    actionText: 'Try it out'
  },
  {
    id: 'ready',
    title: 'All Systems Ready',
    subtitle: 'Your bookmark library is now supercharged.',
    layout: 'centered',
    visualType: 'hero',
    actionText: 'Start Exploring'
  }
]

// --- 状态管理 ---
const currentStepIndex = ref(0)
const direction = ref(1) // 1: next, -1: prev
const progress = ref(0)
const progressMessage = ref('Initializing...')
const isSyncing = ref(true)
const isCompleted = ref(false)

const currentStep = computed(() => steps[currentStepIndex.value])
const isLast = computed(() => currentStepIndex.value === steps.length - 1)

// --- 导航逻辑 ---
function nextStep() {
  if (currentStepIndex.value < steps.length - 1) {
    direction.value = 1
    currentStepIndex.value++
  } else {
    // 🔒 环境检查：确保在浏览器环境中运行
    if (typeof window !== 'undefined') {
      window.close()
    }
  }
}

function prevStep() {
  if (currentStepIndex.value > 0) {
    direction.value = -1
    currentStepIndex.value--
  }
}

// --- 消息监听 ---
const messageListener = (message: ChromeExtensionMessage) => {
  if (message.type === 'acuity-bookmarks-sync-progress') {
    progress.value = message.data.percentage
    progressMessage.value = message.data.message
    
    if (message.data.phase === 'completed') {
      completeSync()
    }
  } else if (message.type === 'acuity-bookmarks-db-ready') {
    completeSync()
  }
}

function completeSync() {
  if (!isCompleted.value) {
    isSyncing.value = false
    isCompleted.value = true
    progress.value = 100
    progressMessage.value = 'Ready'
    
    // 如果用户还停留在同步页，自动跳转（体验优化）
    if (steps[currentStepIndex.value].id === 'sync') {
      setTimeout(() => {
        nextStep()
      }, 1200)
    }
  }
}

onMounted(() => {
  chrome.runtime.onMessage.addListener(messageListener)
  
  // 检查初始状态
  chrome.storage.local.get(['AB_INITIALIZED'], (result) => {
    if (result.AB_INITIALIZED) {
      completeSync()
    }
  })
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(messageListener)
})
function closeWindow() {
  // 🔒 环境检查：确保在浏览器环境中运行
  if (typeof window !== 'undefined') {
    window.close()
  }
}
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden font-sans selection:bg-blue-100 dark:selection:bg-blue-900">
    
    <!-- 顶部导航栏 (Logo) -->
    <nav class="absolute top-0 left-0 w-full p-6 z-50 flex justify-between items-center">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
           <LucideIcon name="bookmark" size="sm" />
        </div>
        <span class="font-bold text-lg tracking-tight">AcuityBookmarks</span>
      </div>
      
      <!-- 快捷跳过 -->
      <button 
        v-if="!isLast && isCompleted"
        class="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
        @click="closeWindow"
      >
        Skip
      </button>
    </nav>

    <!-- 主内容区域 -->
    <main class="relative w-full h-screen flex flex-col">
      
      <!-- 过渡容器 -->
      <Transition :name="direction > 0 ? 'slide-left' : 'slide-right'" mode="out-in">
        
        <!-- 动态内容渲染 -->
        <div :key="currentStep.id" class="w-full h-full flex flex-col justify-center items-center">
          
          <!-- 布局：Centered (欢迎页/结束页) -->
          <div v-if="currentStep.layout === 'centered'" class="max-w-4xl mx-auto px-8 text-center flex flex-col items-center">
            
            <!-- Hero Visual -->
            <div class="mb-12 relative">
               <div class="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full transform scale-150"></div>
               <div v-if="currentStep.id === 'welcome'" class="relative bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 transform rotate-3">
                  <div class="flex items-center gap-4 mb-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                    <div class="w-3 h-3 rounded-full bg-red-400"></div>
                    <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div class="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div class="space-y-3 w-64">
                    <div class="h-4 bg-slate-100 dark:bg-slate-700 rounded w-3/4"></div>
                    <div class="h-4 bg-slate-100 dark:bg-slate-700 rounded w-full"></div>
                    <div class="h-32 bg-blue-50 dark:bg-blue-900/30 rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-800 flex items-center justify-center">
                       <LucideIcon name="bookmark" class="text-blue-500 w-12 h-12 opacity-50" />
                    </div>
                  </div>
               </div>
               
               <div v-else class="relative">
                  <div class="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-green-500/40 animate-bounce-slow">
                    <LucideIcon name="check" class="w-16 h-16" />
                  </div>
               </div>
            </div>

            <h1 class="text-5xl md:text-6xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
              {{ currentStep.title }}
            </h1>
            <p class="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              {{ currentStep.subtitle || currentStep.description }}
            </p>

            <div class="mt-12">
               <button 
                 class="group relative inline-flex items-center justify-center px-8 py-4 font-semibold text-white transition-all duration-200 bg-slate-900 dark:bg-white dark:text-slate-900 rounded-full hover:bg-slate-700 dark:hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900"
                 @click="nextStep"
               >
                 {{ currentStep.actionText || 'Start Tour' }}
                 <LucideIcon name="arrow-right" class="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
               </button>
            </div>
          </div>

          <!-- 布局：Split (功能介绍页) -->
          <div v-else class="w-full max-w-7xl mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            <!-- 视觉区域 (根据 layout 决定顺序) -->
            <div :class="['relative order-1', currentStep.layout === 'split-left' ? 'lg:order-1' : 'lg:order-2']">
               <!-- 背景光效 -->
               <div class="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 rounded-3xl transform rotate-2 scale-105 blur-xl"></div>
               
               <!-- Mockup Container -->
               <div class="relative bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden aspect-[4/3] group">
                  
                  <!-- Mockup: Search -->
                  <div v-if="currentStep.visualType === 'search'" class="p-8 flex flex-col h-full">
                     <!-- 模拟搜索框 -->
                     <div class="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 p-4 flex items-center gap-3 mb-6 transition-shadow duration-200 group-hover:shadow-md dark:group-hover:border-slate-500">
                        <LucideIcon name="search" class="text-slate-400" />
                        <span class="text-slate-500 dark:text-slate-400 text-lg">"design resources"</span>
                     </div>
                     <!-- 模拟结果列表 -->
                     <div class="space-y-3 opacity-80">
                        <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer">
                           <div class="w-10 h-10 rounded bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600">F</div>
                           <div class="flex-1">
                              <div class="h-3 bg-slate-800 dark:bg-slate-200 rounded w-1/3 mb-2"></div>
                              <div class="h-2 bg-slate-300 dark:bg-slate-600 rounded w-2/3"></div>
                           </div>
                        </div>
                        <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer">
                           <div class="w-10 h-10 rounded bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center text-orange-600">D</div>
                           <div class="flex-1">
                              <div class="h-3 bg-slate-800 dark:bg-slate-200 rounded w-1/4 mb-2"></div>
                              <div class="h-2 bg-slate-300 dark:bg-slate-600 rounded w-1/2"></div>
                           </div>
                        </div>
                     </div>
                  </div>

                  <!-- Mockup: Sync -->
                  <div v-else-if="currentStep.visualType === 'sync'" class="h-full flex flex-col items-center justify-center p-8">
                     <div class="relative w-48 h-48">
                        <!-- 外圈进度 -->
                        <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle class="text-slate-100 dark:text-slate-700" stroke-width="8" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
                          <circle class="text-blue-600 transition-all duration-500 ease-out" stroke-width="8" :stroke-dasharray="251.2" :stroke-dashoffset="251.2 * (1 - progress / 100)" stroke-linecap="round" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
                        </svg>
                        <!-- 中心图标/文字 -->
                        <div class="absolute inset-0 flex flex-col items-center justify-center">
                           <span class="text-3xl font-bold text-slate-900 dark:text-white">{{ Math.round(progress) }}%</span>
                           <span class="text-xs text-slate-500 uppercase tracking-wider mt-1">Synced</span>
                        </div>
                     </div>
                     <div class="mt-8 bg-slate-100 dark:bg-slate-700/50 rounded-full px-4 py-2 flex items-center gap-2">
                        <div v-if="isSyncing" class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <div v-else class="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span class="text-sm text-slate-600 dark:text-slate-300 font-medium">{{ progressMessage }}</span>
                     </div>
                  </div>

               </div>
            </div>

            <!-- 文字区域 -->
            <div :class="['flex flex-col justify-center space-y-6 order-2', currentStep.layout === 'split-left' ? 'lg:order-2 lg:pl-12' : 'lg:order-1 lg:pr-12']">
              <div class="inline-flex items-center gap-2 text-blue-600 font-bold tracking-wide uppercase text-sm">
                 <span class="w-8 h-[2px] bg-blue-600"></span>
                 <span>Feature</span>
              </div>
              
              <h2 class="text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white leading-tight">
                 {{ currentStep.title }}
              </h2>
              
              <p class="text-xl text-slate-500 dark:text-slate-400 leading-relaxed">
                 {{ currentStep.description }}
              </p>

              <div class="pt-4">
                 <div v-if="currentStep.id === 'sync'" class="flex items-center gap-4 text-sm text-slate-400">
                    <LucideIcon name="lock" size="sm" />
                    <span>End-to-end local encryption</span>
                 </div>
                 <button 
                   v-if="currentStep.actionText"
                   class="hidden"
                 >
                   <!-- Action button placeholder for layout balance -->
                 </button>
              </div>
            </div>

          </div>
        </div>

      </Transition>

      <!-- 底部导航控制 (Prev/Next Arrows) -->
      <div class="absolute bottom-0 left-0 w-full p-8 lg:p-12 flex justify-between items-center pointer-events-none">
         <!-- Dots Indicator -->
         <div class="flex gap-3 pointer-events-auto">
            <button 
              v-for="(_, idx) in steps" 
              :key="idx"
              :class="['h-2 rounded-full transition-all duration-300', currentStepIndex === idx ? 'w-8 bg-slate-900 dark:bg-white' : 'w-2 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400']"
              @click="() => { direction = idx > currentStepIndex ? 1 : -1; currentStepIndex = idx }"
            ></button>
         </div>

         <!-- Arrows -->
         <div class="flex gap-4 pointer-events-auto">
             <button 
               v-if="currentStepIndex > 0"
               class="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 transition-colors"
               @click="prevStep"
             >
                <LucideIcon name="arrow-left" />
             </button>
             
             <button 
               v-if="!isLast"
               :disabled="currentStep.id === 'sync' && !isCompleted"
               class="w-12 h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-lg transition-shadow duration-200 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
               @click="nextStep"
             >
                <LucideIcon name="arrow-right" />
             </button>
         </div>
      </div>

    </main>
  </div>
</template>

<style scoped>


@keyframes bounce {
  0%, 100% {
    transform: translateY(-5%);
  }

  50% {
    transform: translateY(5%);
  }
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.5s cubic-bezier(0.25, 1, 0.5, 1);
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(40px);
}

.slide-left-leave-to {
  opacity: 0;
  transform: translateX(-40px);
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(-40px);
}

.slide-right-leave-to {
  opacity: 0;
  transform: translateX(40px);
}

.animate-bounce-slow {
  animation: bounce 3s infinite;
}

/* Slide Transitions */
</style>
