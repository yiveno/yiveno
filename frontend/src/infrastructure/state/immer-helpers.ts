/**
 * Immer 辅助函数（用于 Pinia Store）
 *
 * 职责：
 * - 简化 Pinia Store 中的不可变更新操作
 * - 提供类型安全的状态修改
 * - 避免手动深拷贝的繁琐和错误
 *
 * 使用场景：
 * - 复杂的嵌套对象更新
 * - 数组操作（添加、删除、修改元素）
 * - 树形结构的节点更新
 */

import { produce, enableMapSet, type Draft } from 'immer'
import type { Ref } from 'vue'

// ✅ 启用 Immer 的 Map/Set 支持
// 必须在使用 produce 处理 Map/Set 之前调用
enableMapSet()

/**
 * 为 Ref 对象提供 Immer 更新能力
 *
 * @param ref - Vue Ref 对象
 * @param updater - 更新函数（可以直接修改 draft）
 *
 * @example
 * ```typescript
 * const state = ref({
 *   user: {
 *     profile: {
 *       name: 'Alice',
 *       age: 30
 *     }
 *   }
 * })
 *
 * // Before: 手动深拷贝
 * state.value = {
 *   ...state.value,
 *   user: {
 *     ...state.value.user,
 *     profile: {
 *       ...state.value.user.profile,
 *       age: 31
 *     }
 *   }
 * }
 *
 * // After: 使用 Immer
 * updateRef(state, draft => {
 *   draft.user.profile.age = 31  // 直接修改
 * })
 * ```
 */
export function updateRef<T>(ref: Ref<T>, updater: (draft: Draft<T>) => void): void {
  ref.value = produce(ref.value, updater) as T
}

/**
 * 为普通对象提供 Immer 更新能力
 *
 * @param state - 原始状态对象
 * @param updater - 更新函数
 * @returns 新的状态对象
 *
 * @example
 * ```typescript
 * const newState = updateState(oldState, draft => {
 *   draft.items.push(newItem)
 *   draft.count += 1
 * })
 * ```
 */
export function updateState<T>(state: T, updater: (draft: Draft<T>) => void): T {
  return produce(state, updater) as T
}

/**
 * 为 Map 提供 Immer 更新能力
 *
 * @param mapRef - Vue Ref<Map> 对象
 * @param updater - 更新函数
 *
 * @example
 * ```typescript
 * const nodes = ref(new Map<string, BookmarkNode>())
 *
 * updateMap(nodes, draft => {
 *   const node = draft.get('123')
 *   if (node) {
 *     node.title = '新标题'  // 直接修改
 *   }
 * })
 * ```
 */
export function updateMap<K, V>(
  mapRef: Ref<Map<K, V>>,
  updater: (draft: Draft<Map<K, V>>) => void
): void {
  mapRef.value = produce(mapRef.value, updater)
}

/**
 * 为数组提供 Immer 更新能力
 *
 * @param arrayRef - Vue Ref<Array> 对象
 * @param updater - 更新函数
 *
 * @example
 * ```typescript
 * const items = ref<Item[]>([])
 *
 * updateArray(items, draft => {
 *   draft.push(newItem)
 *   draft[0].status = 'completed'
 *   draft.splice(2, 1)  // 删除索引 2 的元素
 * })
 * ```
 */
export function updateArray<T>(arrayRef: Ref<T[]>, updater: (draft: Draft<T[]>) => void): void {
  arrayRef.value = produce(arrayRef.value, updater)
}

/**
 * 条件更新：只有当条件满足时才应用更新
 *
 * @param ref - Vue Ref 对象
 * @param condition - 条件函数
 * @param updater - 更新函数
 *
 * @example
 * ```typescript
 * conditionalUpdate(
 *   state,
 *   (current) => current.isEditing,
 *   (draft) => {
 *     draft.content = newContent
 *   }
 * )
 * ```
 */
export function conditionalUpdate<T>(
  ref: Ref<T>,
  condition: (current: T) => boolean,
  updater: (draft: Draft<T>) => void
): boolean {
  if (!condition(ref.value)) {
    return false
  }

  updateRef(ref, updater)
  return true
}

/**
 * 批量更新：一次应用多个更新
 *
 * @param ref - Vue Ref 对象
 * @param updaters - 更新函数数组
 *
 * @example
 * ```typescript
 * batchUpdate(state, [
 *   draft => { draft.field1 = value1 },
 *   draft => { draft.field2 = value2 },
 *   draft => { draft.field3 = value3 }
 * ])
 * ```
 */
export function batchUpdate<T>(ref: Ref<T>, updaters: Array<(draft: Draft<T>) => void>): void {
  ref.value = produce(ref.value, draft => {
    for (const updater of updaters) {
      updater(draft)
    }
  }) as T
}
