/**
 * 特征数据 Composables
 *
 * 提供响应式的特征数据访问接口
 *
 * 使用示例：
 * ```typescript
 * // 在组件中使用
 * const statistics = useTraitStatistics()
 * const invalidCount = useTraitCount('invalid')
 * const hasProblems = useHasNegativeTraits()
 *
 * // 自动响应数据变化，无需手动刷新
 * ```
 */

import { computed, type ComputedRef } from 'vue'
import { useTraitDataStore, type TraitStatistics } from '@/stores/trait-data-store'
import type { TraitTag } from '@/core/bookmark/trait-rules'

/**
 * 使用特征统计（响应式）
 *
 * @returns 特征统计数据（响应式）
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const statistics = useTraitStatistics()
 * </script>
 *
 * <template>
 *   <div>
 *     <p>重复: {{ statistics.duplicate }}</p>
 *     <p>无效: {{ statistics.invalid }}</p>
 *   </div>
 * </template>
 * ```
 */
export function useTraitStatistics(): ComputedRef<TraitStatistics> {
  const store = useTraitDataStore()

  // 确保已初始化
  if (!store.isInitialized) {
    store.initialize()
  }

  return computed(() => store.statistics)
}

/**
 * 使用特定特征的数量（响应式）
 *
 * @param trait - 特征类型
 * @returns 特征数量（响应式）
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const invalidCount = useTraitCount('invalid')
 * const duplicateCount = useTraitCount('duplicate')
 * </script>
 *
 * <template>
 *   <div>
 *     <p>无效书签: {{ invalidCount }}</p>
 *     <p>重复书签: {{ duplicateCount }}</p>
 *   </div>
 * </template>
 * ```
 */
export function useTraitCount(trait: TraitTag): ComputedRef<number> {
  const store = useTraitDataStore()

  // 确保已初始化
  if (!store.isInitialized) {
    store.initialize()
  }

  return computed(() => store.getCount(trait))
}

/**
 * 使用负面特征总数（响应式）
 *
 * @returns 负面特征总数（响应式）
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const totalProblems = useTotalNegativeTraits()
 * </script>
 *
 * <template>
 *   <div>需要关注: {{ totalProblems }} 个问题</div>
 * </template>
 * ```
 */
export function useTotalNegativeTraits(): ComputedRef<number> {
  const store = useTraitDataStore()

  // 确保已初始化
  if (!store.isInitialized) {
    store.initialize()
  }

  return computed(() => store.totalNegativeTraits)
}

/**
 * 使用是否有负面特征（响应式）
 *
 * @returns 是否有需要关注的特征（响应式）
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const hasProblems = useHasNegativeTraits()
 * </script>
 *
 * <template>
 *   <div v-if="hasProblems" class="alert">
 *     发现需要关注的书签问题
 *   </div>
 * </template>
 * ```
 */
export function useHasNegativeTraits(): ComputedRef<boolean> {
  const store = useTraitDataStore()

  // 确保已初始化
  if (!store.isInitialized) {
    store.initialize()
  }

  return computed(() => store.hasNegativeTraits)
}

/**
 * 使用加载状态（响应式）
 *
 * @returns 是否正在加载（响应式）
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const isLoading = useTraitLoading()
 * </script>
 *
 * <template>
 *   <div v-if="isLoading">加载中...</div>
 * </template>
 * ```
 */
export function useTraitLoading(): ComputedRef<boolean> {
  const store = useTraitDataStore()

  // 确保已初始化
  if (!store.isInitialized) {
    store.initialize()
  }

  return computed(() => store.isLoading)
}

/**
 * 使用最后更新时间（响应式）
 *
 * @returns 最后更新时间戳（响应式）
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const lastUpdated = useTraitLastUpdated()
 * const formattedTime = computed(() => {
 *   if (lastUpdated.value === 0) return '未更新'
 *   return new Date(lastUpdated.value).toLocaleString()
 * })
 * </script>
 *
 * <template>
 *   <div>最后更新: {{ formattedTime }}</div>
 * </template>
 * ```
 */
export function useTraitLastUpdated(): ComputedRef<number> {
  const store = useTraitDataStore()

  // 确保已初始化
  if (!store.isInitialized) {
    store.initialize()
  }

  return computed(() => store.lastUpdated)
}

/**
 * 手动刷新特征数据
 *
 * @returns 刷新函数
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const refreshTraits = useRefreshTraits()
 *
 * async function handleRefresh() {
 *   await refreshTraits()
 *   console.log('刷新完成')
 * }
 * </script>
 *
 * <template>
 *   <button @click="handleRefresh">刷新</button>
 * </template>
 * ```
 */
export function useRefreshTraits(): () => Promise<void> {
  const store = useTraitDataStore()

  // 确保已初始化
  if (!store.isInitialized) {
    store.initialize()
  }

  return () => store.refresh(true)
}
