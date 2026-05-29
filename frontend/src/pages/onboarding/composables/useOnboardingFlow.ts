/**
 * 引导流程控制 Composable
 * 负责步骤切换、状态管理
 */
import { ref, computed } from 'vue'

export interface Step {
  id: string
  title: string
  subtitle?: string
  description: string
  visual: 'hero' | 'sync' | 'search' | 'complete'
  showAction?: boolean
}

export function useOnboardingFlow() {
  const steps: Step[] = [
    {
      id: 'welcome',
      title: 'Welcome to AcuityBookmarks',
      subtitle: 'AI-Powered Bookmark Management',
      description:
        'Unlock the knowledge in your bookmarks with intelligent organization and semantic search.',
      visual: 'hero',
      showAction: true
    },
    {
      id: 'sync',
      title: 'Building Your Local Index',
      description:
        "We're analyzing your bookmarks to create a fast, searchable index. Your data never leaves your device.",
      visual: 'sync'
    },
    {
      id: 'search',
      title: 'AI Semantic Search',
      description:
        'Find bookmarks by meaning, not just keywords. Ask in natural language and get instant, relevant results.',
      visual: 'search',
      showAction: true
    },
    {
      id: 'ready',
      title: 'All Set!',
      description: 'Your bookmark library is supercharged and ready to explore.',
      visual: 'complete',
      showAction: true
    }
  ]

  const currentStepIndex = ref(0)

  const currentStep = computed(() => steps[currentStepIndex.value])
  const isFirst = computed(() => currentStepIndex.value === 0)
  const isLast = computed(() => currentStepIndex.value === steps.length - 1)
  const canGoNext = computed(() => currentStepIndex.value < steps.length - 1)
  const canGoPrev = computed(() => currentStepIndex.value > 0)

  function nextStep() {
    if (canGoNext.value) {
      currentStepIndex.value++
      return true
    }
    return false
  }

  function prevStep() {
    if (canGoPrev.value) {
      currentStepIndex.value--
      return true
    }
    return false
  }

  function goToStep(index: number) {
    if (index >= 0 && index < steps.length) {
      currentStepIndex.value = index
      return true
    }
    return false
  }

  function complete() {
    if (typeof window !== 'undefined') {
      window.close()
    }
  }

  return {
    steps,
    currentStep,
    currentStepIndex,
    isFirst,
    isLast,
    canGoNext,
    canGoPrev,
    nextStep,
    prevStep,
    goToStep,
    complete
  }
}
