import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useSubscription } from '@/composables/useSubscription'
import { useSupabaseAuth } from '@/composables/useSupabaseAuth'
import { detectAiEngineUiReady } from '@/application/ai/ai-engine-availability'
import { llmAdapter } from '@/infrastructure/llm/llm-adapter'
import { logger } from '@/infrastructure/logging/logger'
import {
  AI_ONE_CLICK_ORGANIZE_STORAGE_KEY,
  isAiOneClickOrganizeEnabled
} from '@/core/ai/ai-feature-settings'

/**
 * 管理页 AI 一键整理功能开关与引擎可用性
 */
export function useManagementAiSettings() {
  const { isPro } = useSubscription()
  const { isAuthenticated } = useSupabaseAuth()
  const aiOneClickOrganizeEnabled = ref(true)
  const aiEngineReady = ref(false)

  const showOneClickOrganizeButton = computed(
    () => isPro.value && aiOneClickOrganizeEnabled.value && aiEngineReady.value
  )

  async function loadOneClickOrganizeSetting(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(AI_ONE_CLICK_ORGANIZE_STORAGE_KEY)
      aiOneClickOrganizeEnabled.value = isAiOneClickOrganizeEnabled(
        result[AI_ONE_CLICK_ORGANIZE_STORAGE_KEY]
      )
    } catch (error) {
      logger.error('Management', '加载一键整理设置失败', error)
    }
  }

  async function refreshAIEngineReady(): Promise<void> {
    try {
      llmAdapter.clearCapabilitiesCache()
      aiEngineReady.value = await detectAiEngineUiReady({
        isPro: isPro.value,
        isLoggedIn: isAuthenticated.value
      })
    } catch (error) {
      logger.error('Management', '检测 AI 引擎状态失败', error)
      aiEngineReady.value = false
    }
  }

  const storageListener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ): void => {
    if (areaName !== 'local') return

    if (changes[AI_ONE_CLICK_ORGANIZE_STORAGE_KEY]) {
      aiOneClickOrganizeEnabled.value = isAiOneClickOrganizeEnabled(
        changes[AI_ONE_CLICK_ORGANIZE_STORAGE_KEY].newValue
      )
    }

    if (changes.USER_AI_CONFIG) {
      void refreshAIEngineReady()
    }
  }

  onMounted(() => {
    void loadOneClickOrganizeSetting()
    void refreshAIEngineReady()
    chrome.storage.onChanged.addListener(storageListener)
  })

  watch([isPro, isAuthenticated], () => {
    void refreshAIEngineReady()
  })

  onUnmounted(() => {
    chrome.storage.onChanged.removeListener(storageListener)
  })

  return { showOneClickOrganizeButton }
}
