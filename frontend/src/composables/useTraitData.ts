/**
 * 特征数据 Composables
 */

import { computed, type ComputedRef } from 'vue'
import { useTraitDataStore } from '@/stores/trait-data-store'

/**
 * 使用加载状态（响应式）
 */
export function useTraitLoading(): ComputedRef<boolean> {
  const store = useTraitDataStore()

  if (!store.isInitialized) {
    store.initialize()
  }

  return computed(() => store.isLoading)
}
