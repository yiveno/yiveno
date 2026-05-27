<!--
BookmarkSearchInput - 书签筛选输入组件

职责：
- 提供筛选输入框
- 调用核心书签筛选服务
- 返回标准书签树结构数据
- 不负责展示结果（由父组件决定）

数据流：
用户输入 → 筛选服务 → emit('searchComplete', results)

注意：
- 数据源默认 IndexedDB，可外部传入
- 只负责筛选逻辑，不负责结果展示
- 保持单一职责原则
-->

<script setup lang="ts">
import { watch, computed, ref, nextTick, onMounted, onUnmounted, toRefs } from 'vue'
import { Chip, AnimatedNumber, LucideIcon, Input, Loading } from '@/components'
import { useBookmarkSearch } from '@/composables/useBookmarkSearch'
import { useSearchHistory } from '@/composables/useSearchHistory'
import type { BookmarkNode } from '@/types'
import { useDebounceFn } from '@vueuse/core'
import { useTraitFilterStore } from '@/stores/trait-filter/trait-filter-store'
import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { TraitTag } from '@/infrastructure/indexeddb/types/bookmark-record'
import { t } from '@/utils/i18n-helpers'
import { logger } from '@/infrastructure/logging/logger'
import { faviconService } from '@/services/favicon-service'

defineOptions({
  name: 'BookmarkSearchInput'
})

const props = withDefaults(defineProps<Props>(), {
  displayMode: 'icon',
  mode: 'indexeddb',
  strategy: 'hybrid',
  limit: 100,
  debounce: 300,
  disabled: false,
  placeholder: '',
  initialQuery: '',
  resultDisplay: 'dropdown',
  showResultCount: true,
  maxDropdownResults: 50,
  enableTraitFilters: true,
  syncWithStore: false,
  showQuickFilters: true,
  customQuickFilters: () => [],
  showStats: true,
  autoFocus: false,
  size: 'md',
  rounded: true
})
const emit = defineEmits<Emits>()

// 解构 props 保持响应式
const { mode, strategy, data, limit, initialQuery } = toRefs(props)

// 展开状态
const isExpanded = ref(false)
const inputRef = ref<InstanceType<typeof Input>>()
const searchWrapperRef = ref<HTMLElement | null>(null)

// 输入框焦点状态
const isFocused = ref(false)

// 面板显示状态（独立控制，实现时序动画）
const showPanel = ref(false)
// 快捷标签显示状态
const showQuickTags = ref(false)

// 收起中标志（防止在收起过程中重复操作）
const isCollapsing = ref(false)

// 选中的结果索引（用于键盘导航）
const selectedResultIndex = ref(-1)

// Favicon 缓存（书签ID -> favicon URL）
const faviconCache = ref<Map<string, string>>(new Map())

// ========== 搜索历史 ==========
const {
  // history: searchHistory,
  addToHistory,
  removeFromHistory,
  clearHistory,
  getRecentHistory
} = useSearchHistory()

// 是否显示搜索历史
// const showSearchHistory = ref(false)

// ========== 计算属性：处理新配置 ==========

/**
 * 实际的占位符文本
 */
const actualPlaceholder = computed(() => {
  return props.placeholder || t('search_placeholder')
})

/**
 * 是否始终展开（非 icon 模式）
 */
const isAlwaysExpanded = computed(() => {
  return props.displayMode !== 'icon'
})

/**
 * 合并后的快捷筛选配置
 */
const mergedQuickFilterConfig = computed<QuickFilterConfig>(() => {
  // 向后兼容：优先使用新的 quickFilters prop
  if (props.quickFilters) {
    return {
      enabled: props.quickFilters.enabled ?? props.enableTraitFilters,
      position: props.quickFilters.position ?? 'dropdown',
      filters: props.quickFilters.filters ?? []
    }
  }

  // 向后兼容：使用旧的 props
  return {
    enabled: props.showQuickFilters && props.enableTraitFilters,
    position: 'dropdown',
    filters: props.customQuickFilters ?? []
  }
})

/**
 * 综合的加载状态
 * 包括防抖期间和实际搜索期间
 */
const isLoadingState = computed(() => {
  return isDebouncing.value || isSearching.value
})

/**
 * 是否应该显示面板
 * 只有在有内容时才显示面板（搜索历史、筛选标签、搜索结果）
 */
const shouldShowPanel = computed(() => {
  // 有搜索历史（必须获取焦点）
  if (shouldShowSearchHistory.value) return true

  // 有筛选标签
  if (showQuickTags.value && showFiltersInDropdown.value) return true

  // 有搜索结果
  if (shouldShowResultsDropdown.value) return true

  // 有搜索统计（有查询或有筛选）- 但必须有实际内容
  if (
    props.showStats &&
    props.showResultCount &&
    displayResultCount.value >= 0 &&
    (query.value.trim() || activeFilters.value.size > 0)
  ) {
    // 只有在有查询内容或有激活的筛选器时才显示
    return true
  }

  return false
})

/**
 * 是否应该显示搜索历史
 * 只在输入框获取焦点且为空时显示
 */
const shouldShowSearchHistory = computed(() => {
  // 必须同时满足：输入框为空 + 获取焦点 + 有历史记录
  return !query.value.trim() && isFocused.value && getRecentHistory(5).length > 0
})

/**
 * 是否显示搜索结果下拉列表
 */
const shouldShowResultsDropdown = computed(() => {
  return props.resultDisplay === 'dropdown' && hasSearchResults.value
})

/**
 * 是否有搜索结果
 */
const hasSearchResults = computed(() => {
  return bookmarkNodes.value.length > 0
})

/**
 * 下拉列表中显示的结果（限制数量）
 */
const dropdownResults = computed(() => {
  return flattenBookmarkTree(bookmarkNodes.value).slice(0, props.maxDropdownResults)
})

/**
 * 是否有更多结果（超过下拉列表显示数量）
 */
const hasMoreResults = computed(() => {
  return totalResults.value > props.maxDropdownResults
})

/**
 * 扁平化书签树（用于下拉列表展示）
 */
function flattenBookmarkTree(nodes: BookmarkNode[]): BookmarkNode[] {
  const result: BookmarkNode[] = []

  function traverse(nodeList: BookmarkNode[]) {
    for (const node of nodeList) {
      // 只收集书签节点（有 URL 的）
      if (node.url) {
        result.push(node)
      }
      // 递归处理子节点
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    }
  }

  traverse(nodes)
  return result
}

/**
 * 快捷筛选器配置
 */
export interface QuickFilter {
  /** 筛选器唯一标识 */
  id: string
  /** 显示标签 */
  label: string
  /** 图标名称（可选） */
  icon?: string
  /** 结果数量（可选） */
  count?: number
  /** 自定义筛选逻辑 */
  filter: (node: BookmarkNode) => boolean
}

/**
 * 快捷筛选配置
 */
export interface QuickFilterConfig {
  /** 是否启用快捷筛选 */
  enabled: boolean
  /** 显示位置 */
  position: 'inline' | 'dropdown' | 'none'
  /** 自定义筛选器列表 */
  filters: QuickFilter[]
}

interface Props {
  // ========== 交互模式 ==========
  /**
   * 交互展示模式
   * @default 'icon'
   */
  displayMode?: 'icon' | 'compact' | 'full' | 'inline'

  // ========== 搜索配置 ==========
  /**
   * 搜索模式
   * - indexeddb: 从 IndexedDB 搜索（默认）
   * - memory: 从内存数据搜索
   */
  mode?: 'indexeddb' | 'memory'

  /**
   * 搜索策略（仅 indexeddb 模式有效）
   * - auto: 自动根据输入意图选择（默认）
   * - fuse: 本地 Fuse.js 模糊匹配
   * - semantic: 本地语义向量搜索
   * - hybrid: Fuse 立即返回 + Semantic 异步合并
   */
  strategy?: 'auto' | 'fuse' | 'semantic' | 'hybrid'

  /**
   * 内存数据源（mode='memory' 时使用）
   */
  data?: BookmarkNode[]

  /**
   * 搜索结果数量限制
   * @default 100
   */
  limit?: number

  /**
   * 防抖延迟（毫秒）
   * @default 300
   */
  debounce?: number

  /**
   * 占位符文本
   */
  placeholder?: string

  /**
   * 是否禁用
   */
  disabled?: boolean

  /**
   * 初始搜索关键词
   */
  initialQuery?: string

  // ========== 结果展示 ==========
  /**
   * 搜索结果展示方式
   * @default 'dropdown'
   */
  resultDisplay?: 'dropdown' | 'navigate' | 'emit'

  /**
   * 是否显示结果数量
   * @default true
   */
  showResultCount?: boolean

  /**
   * 下拉列表最多显示几条结果
   * @default 50
   */
  maxDropdownResults?: number

  // ========== 快捷筛选 ==========
  /**
   * 快捷筛选配置
   */
  quickFilters?: Partial<QuickFilterConfig>

  /**
   * 是否启用内置的特征筛选标签（向后兼容）
   * @default true
   * @deprecated 使用 quickFilters.enabled 代替
   */
  enableTraitFilters?: boolean

  /**
   * 是否与全局 cleanupStore 同步筛选状态
   * @default false
   */
  syncWithStore?: boolean

  /**
   * 是否显示快捷筛选标签（向后兼容）
   * @default true
   * @deprecated 使用 quickFilters.enabled 代替
   */
  showQuickFilters?: boolean

  /**
   * 自定义快捷筛选器配置（向后兼容）
   * @deprecated 使用 quickFilters.filters 代替
   */
  customQuickFilters?: QuickFilter[]

  // ========== 高级功能 ==========
  /**
   * 是否显示统计信息
   * @default true
   */
  showStats?: boolean

  /**
   * 是否自动聚焦
   * @default false
   */
  autoFocus?: boolean

  // ========== 样式定制 ==========
  /**
   * 组件尺寸
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * 是否圆角
   * @default true
   */
  rounded?: boolean
}

interface Emits {
  /**
   * 搜索完成事件
   * @param results - 搜索结果（标准书签树结构）
   */
  (e: 'searchComplete', results: BookmarkNode[]): void

  /**
   * 搜索开始事件
   * @param query - 搜索关键词
   */
  (e: 'searchStart', query: string): void

  /**
   * 搜索错误事件
   * @param error - 错误对象
   */
  (e: 'searchError', error: Error): void

  /**
   * 搜索清空事件
   */
  (e: 'searchClear'): void

  /**
   * 结果项点击事件（dropdown 模式）
   * @param bookmark - 被点击的书签
   */
  (e: 'resultClick', bookmark: BookmarkNode): void

  /**
   * 查看全部结果事件（dropdown 模式）
   * @param results - 所有搜索结果
   */
  (e: 'viewAll', results: BookmarkNode[]): void
}

// ========== 快捷筛选器状态管理 ==========

/** 当前激活的筛选器 ID 集合 */
const activeFilters = ref<Set<string>>(new Set())

// 获取 TraitFilterStore 实例以访问特征统计数据
const traitFilterStore = useTraitFilterStore()

/**
 * 特征统计数据（响应式）
 */
const traitCounts = ref({
  invalid: 0,
  duplicate: 0
})

/** 特征统计是否正在加载 */
const isLoadingTraitCounts = ref(false)

/**
 * 统计特征问题数量
 *
 * @description
 * ⚠️ 统一从 traitTags 字段读取，确保与筛选逻辑一致。
 * 这是唯一可靠的数据源，因为：
 * 1. traitTags 在书签同步时就会设置
 * 2. isDuplicate/isInvalid 字段可能因为数据迁移不完整而缺失
 * 3. 必须保证统计数量和筛选结果的数据来源一致
 *
 * 性能优化：只统计非文件夹的书签（url 存在的）
 */
async function updateTraitCounts(): Promise<void> {
  if (!props.enableTraitFilters) return

  isLoadingTraitCounts.value = true

  try {
    // ✅ 加载所有书签，从 traitTags 字段统计（与筛选逻辑一致）
    const allBookmarks = await indexedDBManager.getAllBookmarks()

    // ✅ 统计重复书签：从 traitTags 读取，只统计有 URL 的书签
    const duplicateCount = allBookmarks.filter(
      b => b.url && b.traitTags && b.traitTags.includes('duplicate')
    ).length

    // ✅ 统计无效书签：从 traitTags 读取，只统计有 URL 的书签
    const invalidCount = allBookmarks.filter(
      b => b.url && b.traitTags && b.traitTags.includes('invalid')
    ).length

    traitCounts.value = {
      invalid: invalidCount,
      duplicate: duplicateCount
    }
  } catch (error) {
    console.error('[BookmarkSearchInput] 更新特征统计失败:', error)
    traitCounts.value = { invalid: 0, duplicate: 0 }
  } finally {
    isLoadingTraitCounts.value = false
  }
}

/**
 * 内置的特征筛选器配置
 */
const builtInTraitFilters = computed<QuickFilter[]>(() => {
  if (!props.enableTraitFilters) return []

  return [
    {
      id: 'invalid',
      label: '无效书签',
      icon: 'alert-circle',
      count: traitCounts.value.invalid,
      filter: (node: BookmarkNode) => {
        const isRootNode = !node.parentId || node.parentId === '0'
        if (isRootNode) return false
        // 无效书签（URL格式错误）
        return node.traitTags?.includes('invalid') ?? false
      }
    },
    {
      id: 'duplicate',
      label: '重复书签',
      icon: 'copy',
      count: traitCounts.value.duplicate,
      filter: (node: BookmarkNode) => node.traitTags?.includes('duplicate') ?? false
    }
  ]
})

/**
 * 合并的筛选器列表（内置 + 自定义）
 */
const allQuickFilters = computed<QuickFilter[]>(() => {
  const config = mergedQuickFilterConfig.value

  // 如果禁用了快捷筛选，返回空数组
  if (!config.enabled) {
    return []
  }

  // 合并内置特征筛选器和自定义筛选器
  return [...builtInTraitFilters.value, ...config.filters]
})

/** 是否有可用的快捷筛选器 */
const hasQuickFilters = computed(() => {
  return mergedQuickFilterConfig.value.enabled && allQuickFilters.value.length > 0
})

/**
 * 快捷筛选器是否应该显示在下拉面板中
 */
const showFiltersInDropdown = computed(() => {
  return mergedQuickFilterConfig.value.position === 'dropdown' && hasQuickFilters.value
})

/**
 * 切换筛选器的激活状态
 * @param filterId - 筛选器 ID
 */
const toggleFilter = async (filterId: string) => {
  if (activeFilters.value.has(filterId)) {
    activeFilters.value.delete(filterId)
  } else {
    activeFilters.value.add(filterId)
  }

  // ✅ 仅在启用特征标签筛选时，同步状态到 TraitFilterStore
  if (props.enableTraitFilters) {
    const activeTraitTags = Array.from(activeFilters.value).filter(id =>
      ['duplicate', 'invalid'].includes(id)
    ) as TraitTag[]

    if (activeTraitTags.length > 0) {
      traitFilterStore.setActiveFilters(activeTraitTags)
    } else {
      // 如果没有激活的特征标签，清除筛选状态
      traitFilterStore.clearFilters()
    }
  }

  // 重新触发筛选
  executeFilter()
}

// 使用书签搜索 Composable
const {
  query,
  bookmarkNodes,
  isFiltering: isSearching,
  error,
  totalResults,
  executionTime,
  filter,
  clear
} = useBookmarkSearch({
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  mode: mode.value,
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  strategy: strategy.value,
  data: computed(() => data.value ?? []),
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  limit: limit.value,
  // eslint-disable-next-line vue/no-ref-object-reactivity-loss
  initialQuery: initialQuery.value,
  autoFilter: false // 手动控制搜索时机
})

// ✅ 本地筛选结果计数（用于健康度筛选场景）
const localFilteredCount = ref<number>(0)

/**
 * 实际显示的结果数量
 * - 有健康度筛选时：始终使用 localFilteredCount（递归统计最终结果树）
 * - 仅文本搜索时：使用 useBookmarkSearch 返回的 totalResults（IndexedDB 搜索的准确结果）
 *
 * 原因：健康度筛选会在文本搜索结果上进一步过滤，所以必须使用最终统计
 */
const displayResultCount = computed(() => {
  const hasTextQuery = query.value.trim().length > 0
  const hasActiveFilters = activeFilters.value.size > 0

  // 有健康度筛选：使用本地统计（无论是否有文本搜索）
  if (hasActiveFilters) {
    return localFilteredCount.value
  }

  // 仅文本搜索：使用 useBookmarkSearch 的结果
  if (hasTextQuery) {
    return totalResults.value
  }

  // 无搜索无筛选：返回 0
  return 0
})

/**
 * 递归统计筛选结果中的叶子节点数量
 *
 * 统计规则：只统计"叶子节点"（在最终结果树中最深层的匹配节点）
 * - 空文件夹：children 为空数组 [] 的节点（是叶子节点）
 * - 重复书签/无效链接：没有 children 属性的节点（是叶子节点）
 * - 父文件夹：有非空 children 的节点（不是叶子节点，不统计）
 *
 * @param nodes - 节点数组
 * @returns 叶子节点数量
 */
const countFilteredItems = (nodes: BookmarkNode[], depth = 0): number => {
  let count = 0

  for (const node of nodes) {
    const hasChildren = node.children && Array.isArray(node.children)

    if (hasChildren && node.children!.length > 0) {
      // 有非空子节点：这是父文件夹，递归统计子节点，但不统计自己
      const childCount = countFilteredItems(node.children!, depth + 1)
      count += childCount
    } else {
      // 叶子节点：无子节点的书签 OR 空文件夹（children 为 []）
      count++
    }
  }

  return count
}

/**
 * 应用快捷筛选器到结果集
 * @param nodes - 原始节点数组
 * @returns 筛选后的节点数组
 */
const applyQuickFilters = (nodes: BookmarkNode[]): BookmarkNode[] => {
  if (activeFilters.value.size === 0) {
    return nodes
  }

  const activeFilterFns = Array.from(activeFilters.value)
    .map(id => allQuickFilters.value.find(f => f.id === id)?.filter)
    .filter((fn): fn is (node: BookmarkNode) => boolean => fn !== undefined)

  if (activeFilterFns.length === 0) {
    return nodes
  }

  // 递归筛选节点树
  const filterNodes = (nodeList: BookmarkNode[]): BookmarkNode[] => {
    const result: BookmarkNode[] = []

    for (const node of nodeList) {
      // 检查当前节点是否匹配所有激活的筛选器
      const matchesAllFilters = activeFilterFns.every(fn => fn(node))

      // ✅ 修复：不依赖 type 字段，直接检查 children 是否存在
      if (node.children && Array.isArray(node.children) && node.children.length > 0) {
        // 递归筛选子节点
        const filteredChildren = filterNodes(node.children)

        // 如果有符合条件的子节点，或者文件夹本身符合条件，则保留该文件夹
        if (filteredChildren.length > 0 || matchesAllFilters) {
          result.push({
            ...node,
            children: filteredChildren
          })
        }
      } else if (matchesAllFilters) {
        // 书签节点符合条件
        result.push(node)
      }
    }

    return result
  }

  return filterNodes(nodes)
}

/**
 * 执行筛选（组合文本搜索 + 快捷筛选器）
 */
const executeFilter = async () => {
  try {
    const hasTextQuery = query.value.trim().length > 0
    const hasActiveFilters = activeFilters.value.size > 0

    // 重置选中索引
    selectedResultIndex.value = -1

    // 如果既无文本又无筛选器，清空结果
    if (!hasTextQuery && !hasActiveFilters) {
      clear()
      localFilteredCount.value = 0 // ✅ 清空本地计数
      emit('searchComplete', [])
      emit('searchClear')
      return
    }

    // 步骤 1: 如果有文本搜索，先执行文本筛选
    let results: BookmarkNode[] = []
    if (hasTextQuery) {
      emit('searchStart', query.value)
      await filter(query.value)
      results = bookmarkNodes.value

      // ✅ 保存到搜索历史
      await addToHistory(query.value, totalResults.value)
    } else {
      // 如果没有文本搜索，使用完整的数据源
      results = props.data ?? []
    }

    // 步骤 2: 应用快捷筛选器
    if (hasActiveFilters) {
      results = applyQuickFilters(results)
    }

    // ✅ 统计最终结果中的项目数量（根据筛选类型智能判断统计书签还是文件夹）
    localFilteredCount.value = countFilteredItems(results)

    // 发送最终结果
    emit('searchComplete', results)
  } catch (err) {
    const searchError = err instanceof Error ? err : new Error(String(err))
    localFilteredCount.value = 0 // ✅ 出错时清空计数
    selectedResultIndex.value = -1 // ✅ 重置选中索引
    emit('searchError', searchError)
  }
}

// 防抖搜索
const debouncedSearch = useDebounceFn(executeFilter, () => props.debounce)

// 本地 loading 状态（用于显示防抖期间的加载动画）
const isDebouncing = ref(false)

// 监听搜索关键词变化
watch(query, () => {
  // 开始防抖，显示加载动画
  isDebouncing.value = true

  debouncedSearch().finally(() => {
    // 防抖完成，隐藏加载动画
    isDebouncing.value = false
  })
})

// ✅ showQuickTags 跟随 showPanel 同步变化
watch(showPanel, visible => {
  showQuickTags.value = visible
})

// ✅ 监听 traitFilterStore 的 activeFilters，同步到组件内部状态
// 用于支持从 URL 参数（popup 跳转）激活筛选
watch(
  () => traitFilterStore.activeFilters,
  storeFilters => {
    // 只有启用特征筛选且开启 store 同步时才处理
    if (!props.enableTraitFilters || !props.syncWithStore) return

    // ✅ 确保 storeFilters 是数组，防止类型错误
    const filtersArray = Array.isArray(storeFilters) ? storeFilters : []

    // 将 store 的 activeFilters (TraitTag[]) 同步到组件的 activeFilters (Set<string>)
    const newFilters = new Set(filtersArray)

    // 只有当筛选器真正变化时才更新（避免循环更新）
    const currentFilters = new Set(activeFilters.value)
    const hasChanges =
      newFilters.size !== currentFilters.size ||
      Array.from(newFilters).some(f => !currentFilters.has(f))

    if (hasChanges) {
      activeFilters.value = newFilters

      // 如果有激活的筛选器，自动展开搜索框
      if (newFilters.size > 0 && !isExpanded.value) {
        isExpanded.value = true
      }

      // 触发筛选
      executeFilter()
    }
  },
  { deep: true, immediate: true }
)

/**
 * 处理搜索框展开/收起动画完成事件
 */
const handleSearchBoxTransitionEnd = (event: TransitionEvent) => {
  // 只处理 width 属性的过渡（搜索框展开/收起动画）
  if (event.propertyName !== 'width') return

  if (isExpanded.value && !showPanel.value) {
    // 展开完成 → 显示面板
    showPanel.value = true
  } else if (!isExpanded.value && !showPanel.value) {
    // 收起完成
    isCollapsing.value = false
  }
}

/**
 * 处理面板出场/离场动画完成事件
 */
const handlePanelTransitionEnd = () => {
  if (!showPanel.value && isCollapsing.value) {
    // 面板离场完成 → 收起搜索框
    isExpanded.value = false
  }
}

// 处理图标点击
const handleIconClick = async () => {
  if (query.value) {
    // 如果有内容，点击清空
    handleClear()
  } else if (isExpanded.value) {
    // 如果已展开且无内容，收起
    // 步骤1：先让面板离场
    if (!isCollapsing.value) {
      isCollapsing.value = true
      showPanel.value = false
      // 面板动画完成后，handlePanelTransitionEnd 会收起搜索框
    }
  } else {
    // 展开
    // 步骤1：先展开搜索框
    isExpanded.value = true
    await nextTick()
    inputRef.value?.$el?.querySelector('input')?.focus()
    // 搜索框展开完成后，handleSearchBoxTransitionEnd 会显示面板
  }
}

// 处理 ESC 键
const handleEscape = () => {
  if (query.value) {
    handleClear()
  } else if (isExpanded.value && !isCollapsing.value && props.displayMode === 'icon') {
    // 收起：先让面板离场（仅 icon 模式）
    isCollapsing.value = true
    showPanel.value = false
  }
}

/**
 * 处理向下箭头键（键盘导航）
 */
const handleArrowDown = () => {
  if (!shouldShowResultsDropdown.value) return

  if (selectedResultIndex.value < dropdownResults.value.length - 1) {
    selectedResultIndex.value++
  }
}

/**
 * 处理向上箭头键（键盘导航）
 */
const handleArrowUp = () => {
  if (!shouldShowResultsDropdown.value) return

  if (selectedResultIndex.value > 0) {
    selectedResultIndex.value--
  }
}

/**
 * 处理 Enter 键
 */
const handleEnter = () => {
  if (!shouldShowResultsDropdown.value) return

  // 如果有选中的结果，打开它
  if (selectedResultIndex.value >= 0 && selectedResultIndex.value < dropdownResults.value.length) {
    const selectedBookmark = dropdownResults.value[selectedResultIndex.value]
    if (selectedBookmark) {
      handleResultClick(selectedBookmark)
    }
  }
}

/**
 * 处理输入框获取焦点
 */
const handleFocus = () => {
  isFocused.value = true
  logger.info('BookmarkSearchInput', '输入框获取焦点')
}

/**
 * 处理输入框失去焦点
 */
const handleBlur = () => {
  // 延迟隐藏，避免点击历史项时立即隐藏
  setTimeout(() => {
    isFocused.value = false
    logger.info('BookmarkSearchInput', '输入框失去焦点', {
      isFocused: isFocused.value,
      shouldShowSearchHistory: shouldShowSearchHistory.value,
      shouldShowPanel: shouldShowPanel.value
    })
  }, 200)
}

/**
 * 处理点击外部区域
 */
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  const wrapper = searchWrapperRef.value

  // 如果点击的是外部区域，隐藏面板
  if (wrapper && !wrapper.contains(target)) {
    isFocused.value = false
    logger.info('BookmarkSearchInput', '点击外部区域，隐藏面板')
  }
}

/**
 * 处理历史记录项点击
 */
const handleHistoryClick = (historyQuery: string) => {
  query.value = historyQuery
  // 重新获取焦点
  isFocused.value = true
  // 触发搜索
  executeFilter()
}

/**
 * 处理删除历史记录
 */
const handleRemoveHistory = (historyQuery: string, event: Event) => {
  event.stopPropagation() // 阻止触发点击事件
  removeFromHistory(historyQuery)
}

/**
 * 处理清空所有历史
 */
const handleClearAllHistory = () => {
  clearHistory()
}

/**
 * 处理结果项点击
 */
const handleResultClick = (bookmark: BookmarkNode) => {
  logger.info('BookmarkSearchInput', '结果项被点击', { bookmark })

  // 先触发事件（让父组件有机会处理）
  emit('resultClick', bookmark)

  // 根据 resultDisplay 模式决定默认行为
  if (props.resultDisplay === 'dropdown') {
    // dropdown 模式：在当前标签页打开书签
    if (bookmark.url) {
      // 安全检查：确保 chrome.tabs API 可用
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.update) {
        chrome.tabs.update({ url: bookmark.url }).catch(err => {
          logger.error('BookmarkSearchInput', '打开书签失败', err)
        })
      } else {
        logger.warn('BookmarkSearchInput', 'chrome.tabs API 不可用，无法打开书签')
      }
    }
  }
}

/**
 * 处理在新标签页打开书签
 */
const handleOpenInNewTab = (bookmark: BookmarkNode) => {
  logger.info('BookmarkSearchInput', '在新标签页打开书签', { bookmark })

  if (bookmark.url) {
    // 安全检查：确保 chrome.tabs API 可用
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: bookmark.url, active: false }).catch(err => {
        logger.error('BookmarkSearchInput', '在新标签页打开书签失败', err)
      })
    } else {
      logger.warn('BookmarkSearchInput', 'chrome.tabs API 不可用，无法打开书签')
    }
  }
}

/**
 * 处理 favicon 加载错误
 */
const handleFaviconError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none' // 隐藏加载失败的图片，显示回退图标
}

/**
 * 为书签加载 favicon
 */
const loadFavicon = async (bookmark: BookmarkNode) => {
  if (!bookmark.url || faviconCache.value.has(bookmark.id)) return

  try {
    const faviconUrl = await faviconService.getFavicon(bookmark.url)
    if (faviconUrl) {
      faviconCache.value.set(bookmark.id, faviconUrl)
    }
  } catch (faviconError) {
    logger.debug('BookmarkSearchInput', 'Favicon加载失败', {
      bookmarkId: bookmark.id,
      error: faviconError
    })
  }
}

/**
 * 批量加载搜索结果的 favicon
 */
watch(
  dropdownResults,
  newResults => {
    newResults.forEach(bookmark => {
      if (bookmark.url && !faviconCache.value.has(bookmark.id)) {
        loadFavicon(bookmark)
      }
    })
  },
  { immediate: true }
)

// ✅ 移除"查看全部"按钮功能（已废弃）
// 用户可以直接在下拉列表中滚动查看最多 50 条结果
// 如果需要查看更多，可以去 Management 页面

// 清空搜索
const handleClear = () => {
  clear()
  activeFilters.value.clear() // ✅ 清空激活的筛选器
  localFilteredCount.value = 0 // ✅ 重置本地计数
  selectedResultIndex.value = -1 // ✅ 重置选中索引
  // ✅ 统一通过 searchComplete 事件通知父组件（传递空数组）
  emit('searchComplete', [])
  // 🔔 同时保留 searchClear 事件，用于特殊场景（如关闭搜索框）
  emit('searchClear')
}

/**
 * 手动触发搜索
 * @param searchQuery - 搜索关键词
 */
const search = async (searchQuery: string) => {
  query.value = searchQuery
  await filter(searchQuery)
  emit('searchComplete', bookmarkNodes.value)
}

/**
 * 获取当前搜索结果
 */
const getResults = () => bookmarkNodes.value

/**
 * 清空搜索
 */
const clearSearch = () => {
  clear()
  activeFilters.value.clear() // ✅ 清空激活的筛选器
  // ✅ 统一通过 searchComplete 事件通知父组件（传递空数组）
  emit('searchComplete', [])
  // 🔔 同时保留 searchClear 事件，用于特殊场景（如关闭搜索框）
  emit('searchClear')
}

// ========== 生命周期 ==========

/**
 * 组件挂载时初始化
 */
onMounted(() => {
  // 如果是始终展开模式，直接显示面板
  if (isAlwaysExpanded.value) {
    isExpanded.value = true
    showPanel.value = true
  }

  // 如果启用了特征筛选，初始化特征统计
  if (mergedQuickFilterConfig.value.enabled) {
    updateTraitCounts()
  }

  // 如果设置了自动聚焦
  if (props.autoFocus && isAlwaysExpanded.value) {
    nextTick(() => {
      inputRef.value?.$el?.querySelector('input')?.focus()
    })
  }

  // 监听全局点击事件，处理点击外部区域
  document.addEventListener('click', handleClickOutside)
})

/**
 * 组件卸载时清理
 */
onUnmounted(() => {
  // 移除全局点击监听
  document.removeEventListener('click', handleClickOutside)
})

/**
 * 监听书签数据同步消息，自动刷新特征统计和清除搜索缓存
 */
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'acuity-bookmarks-db-synced') {
      // 使用 queueMicrotask 避免阻塞消息处理
      queueMicrotask(async () => {
        void updateTraitCounts()
        // 清除 Worker 适配器的缓存，确保搜索使用最新数据
        const { queryWorkerAdapter } = await import('@/services/query-worker-adapter')
        queryWorkerAdapter.clearCache()
      })
    }
  })
}

defineExpose({
  search,
  getResults,
  clear: clearSearch,
  isSearching: isLoadingState,
  totalResults
})
</script>

<template>
  <div class="bookmark-search-input" :class="`display-mode--${props.displayMode}`">
    <!-- 可展开搜索框 -->
    <div
      ref="searchWrapperRef"
      class="search-wrapper"
      :class="{
        expanded: isExpanded || isAlwaysExpanded,
        searching: isLoadingState,
        'always-expanded': isAlwaysExpanded
      }"
      @transitionend="handleSearchBoxTransitionEnd"
    >
      <!-- 输入框容器 -->
      <div class="input-container">
        <Input
          ref="inputRef"
          v-model="query"
          class="search-input"
          :placeholder="actualPlaceholder"
          :disabled="disabled"
          variant="outlined"
          clearable
          leading-icon="search"
          :leading-icon-size="20"
          @focus="handleFocus"
          @blur="handleBlur"
          @keydown.esc="handleEscape"
          @keydown.down.prevent="handleArrowDown"
          @keydown.up.prevent="handleArrowUp"
          @keydown.enter="handleEnter"
          @clear="handleClear"
        />
      </div>

      <!-- 搜索图标按钮（仅 icon 模式显示） -->
      <md-icon-button
        v-if="props.displayMode === 'icon'"
        class="search-icon-button"
        :class="{ 'has-query': query.length > 0 }"
        :style="{ '--md-icon-button-icon-size': '20px' }"
        :title="isLoadingState ? '搜索中...' : query.length > 0 ? '清空' : '搜索'"
        :aria-label="isLoadingState ? '搜索中' : query.length > 0 ? '清空搜索' : '展开搜索'"
        :aria-expanded="isExpanded"
        @click="handleIconClick"
      >
        <Loading v-if="isLoadingState" size="xs" />
        <LucideIcon v-else-if="query.length > 0" name="x" :size="20" />
        <LucideIcon v-else name="search" :size="20" />
      </md-icon-button>

      <!-- 搜索结果面板（包含筛选标签 + 搜索结果） -->
      <Transition name="panel-fade" @after-leave="handlePanelTransitionEnd">
        <div v-if="showPanel && shouldShowPanel" class="search-result-panel">
          <!-- 搜索历史（输入框为空时显示） -->
          <div v-if="shouldShowSearchHistory" class="search-history-panel">
            <div class="history-header">
              <span class="history-title">最近搜索</span>
              <button class="history-clear-btn" @click="handleClearAllHistory">
                <LucideIcon name="trash-2" :size="14" />
                <span>清空</span>
              </button>
            </div>
            <md-list class="history-list">
              <md-list-item
                v-for="item in getRecentHistory(5)"
                :key="item.timestamp"
                type="button"
                @click="handleHistoryClick(item.query)"
              >
                <LucideIcon slot="start" name="clock" :size="14" />
                <div slot="headline">{{ item.query }}</div>
                <div
                  v-if="item.resultCount !== undefined"
                  slot="supporting-text"
                  class="history-count"
                >
                  {{ item.resultCount }} 个结果
                </div>
                <md-icon-button slot="end" @click.stop="handleRemoveHistory(item.query, $event)">
                  <LucideIcon name="x" :size="14" />
                </md-icon-button>
              </md-list-item>
            </md-list>
          </div>

          <!-- 快捷筛选标签（可选显示） -->
          <div v-if="showQuickTags && showFiltersInDropdown" class="filter-quick-tags">
            <button
              v-for="quickFilter in allQuickFilters"
              :key="quickFilter.id"
              class="filter-tag"
              :class="{
                active: activeFilters.has(quickFilter.id),
                loading: isLoadingTraitCounts
              }"
              :title="quickFilter.label"
              :aria-label="`${quickFilter.label}${activeFilters.has(quickFilter.id) ? '（已选中）' : ''}`"
              :aria-pressed="activeFilters.has(quickFilter.id)"
              tabindex="0"
              @click="toggleFilter(quickFilter.id)"
              @keydown.enter.prevent="toggleFilter(quickFilter.id)"
              @keydown.space.prevent="toggleFilter(quickFilter.id)"
            >
              <LucideIcon v-if="quickFilter.icon" :name="quickFilter.icon" :size="14" />
              <span class="filter-label">{{ quickFilter.label }}</span>
              <!-- ✅ 加载状态：显示动画 -->
              <Loading v-if="isLoadingTraitCounts" size="xs" />
              <!-- ✅ 加载完成：显示实际数量 -->
              <Chip
                v-else-if="quickFilter.count !== undefined"
                type="assist"
                size="sm"
                variant="soft"
                color="primary"
                class="filter-count"
              >
                <AnimatedNumber :value="quickFilter.count" />
              </Chip>
            </button>
          </div>

          <!-- 搜索结果下拉列表 -->
          <div v-if="shouldShowResultsDropdown" class="search-results-dropdown">
            <md-list class="result-list">
              <md-list-item
                v-for="(bookmark, index) in dropdownResults"
                :key="bookmark.id"
                type="button"
                :class="{ 'result-item--selected': selectedResultIndex === index }"
                @click="handleResultClick(bookmark)"
                @mouseenter="selectedResultIndex = index"
              >
                <!-- 左侧图标：书签网站图标 -->
                <div slot="start" class="result-favicon">
                  <img
                    v-if="faviconCache.get(bookmark.id)"
                    :src="faviconCache.get(bookmark.id)"
                    :alt="bookmark.title || '书签图标'"
                    class="favicon-img"
                    @error="handleFaviconError"
                  />
                  <LucideIcon v-else name="bookmark" :size="24" />
                </div>

                <!-- 主标题 -->
                <div slot="headline" class="result-headline">
                  {{ bookmark.title || '无标题' }}
                </div>

                <!-- 副标题（URL） -->
                <div v-if="bookmark.url" slot="supporting-text" class="result-url">
                  {{ bookmark.url }}
                </div>

                <!-- 右侧操作按钮：在新标签页打开 -->
                <md-icon-button
                  slot="end"
                  class="result-action-btn"
                  @click.stop="handleOpenInNewTab(bookmark)"
                >
                  <LucideIcon name="external-link" :size="14" />
                </md-icon-button>
              </md-list-item>
            </md-list>

            <!-- 底部提示：当结果超过 50 条时显示 -->
            <div v-if="hasMoreResults" class="more-results-hint">
              <LucideIcon name="info" :size="14" />
              <span>在 Management 页面可以查看全部 {{ totalResults }} 个结果</span>
            </div>
          </div>

          <!-- 搜索结果统计（只在有搜索内容时显示，0 个结果也显示） -->
          <div
            v-if="
              showStats &&
              showResultCount &&
              displayResultCount >= 0 &&
              (query.trim() || activeFilters.size > 0)
            "
            class="search-stats"
          >
            <span class="stats-text">找到 {{ displayResultCount }} 个结果</span>
            <span v-if="executionTime" class="stats-time"> ({{ executionTime }}ms) </span>
          </div>
        </div>
      </Transition>

      <!-- 错误提示（绝对定位在搜索框下方） -->
      <Transition name="error-fade">
        <div v-if="error && isExpanded" class="search-error">
          <LucideIcon name="alert-circle" :size="16" />
          <span class="error-text">{{ error.message }}</span>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* stylelint-disable declaration-property-value-disallowed-list -- 搜索输入组件使用特定尺寸 */

.bookmark-search-input {
  position: relative;
  display: flex;
  align-items: flex-end;
}

/* ========== Display Mode 样式 ========== */

/* 搜索框包裹器 - 基础样式 */
.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: visible; /* 让绝对定位的子元素（下拉面板）可见 */
}

/* icon 模式：默认圆形，点击展开 */
.display-mode--icon .search-wrapper {
  width: 32px;
  border-radius: 16px;
}

.display-mode--icon .search-wrapper.expanded {
  width: 280px;
  border-radius: var(--border-radius-md);
}

/* compact 模式：紧凑搜索框，始终显示 */
.display-mode--compact .search-wrapper {
  width: 200px;
  border-radius: var(--border-radius-md);
}

/* full 模式：完整搜索框 */
.display-mode--full .search-wrapper {
  width: 100%;
  min-width: 300px;
  border-radius: var(--border-radius-md);
}

/* inline 模式：内联模式，无边框 */
.display-mode--inline .search-wrapper {
  width: 100%;
}

/* 输入框容器 - 基础样式 */
.input-container {
  width: 0;
  height: 100%;
  padding-right: 32px; /* 为绝对定位的搜索按钮留出空间 */
  opacity: 0;
  transition:
    opacity 0.2s ease 0.1s,
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* 非 icon 模式：输入框始终可见 */
.display-mode--compact .input-container,
.display-mode--full .input-container,
.display-mode--inline .input-container {
  width: 100%;
  padding-right: 0;
  opacity: 1;
}

/* 始终展开模式（非 icon 模式） */
.search-wrapper.always-expanded .input-container {
  width: 100%;
  opacity: 1;
}

/* 展开状态（仅 icon 模式） - 特异性最高,必须在最后 */
.display-mode--icon .search-wrapper.expanded .input-container {
  width: 100%;
  opacity: 1;
}

/* 输入框样式 */
.search-input {
  width: 100%;
  height: 100%;
}

/* 搜索图标按钮 - 使用绝对定位固定在右侧 */
.search-icon-button {
  position: absolute;
  top: 0;
  right: -1px; /* 抵消容器边框 */
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 32px;
  border: none;
  border-radius: 50%;
  outline: none;
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    opacity 0.2s ease;
}

.search-icon-button:hover {
  background: var(--color-bg-hover);
  box-shadow: 0 2px 4px var(--color-shadow-010);
}

.search-icon-button:active {
  background: var(--color-bg-active);
  opacity: 0.8;
  box-shadow: 0 1px 2px var(--color-shadow-010);
}

/* 当有查询内容时，按钮更明显 */
.search-icon-button.has-query {
  background: var(--color-error-subtle);
}

.search-icon-button.has-query:hover {
  background: var(--color-error);
  box-shadow: 0 2px 6px var(--color-error-alpha-30);
}

.search-icon-button.has-query:hover :deep(.acuity-icon) {
  color: var(--color-text-on-primary);
}

/* 搜索结果面板（包含筛选标签 + 搜索结果） */
.search-result-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  max-height: 400px;
  padding: var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  background: var(--color-surface);
  box-shadow: 0 2px 8px var(--color-shadow-008);
  overflow-y: auto;
}

/* 搜索结果下拉列表 */
.search-results-dropdown {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.result-list {
  /* 移除 max-height 和 overflow-y，让外层容器控制滚动 */
  border-radius: var(--radius-md);
}

/* Material Web List 样式覆盖 - 搜索结果 */
.result-list md-list {
  --md-list-container-color: transparent;
}

.result-list md-list-item {
  --md-list-item-label-text-color: var(--md-sys-color-on-surface);
  --md-list-item-supporting-text-color: var(--md-sys-color-on-surface-variant);
  --md-list-item-container-shape: var(--radius-sm);
  --md-list-item-label-text-font: var(--font-family-base);
  --md-list-item-label-text-size: var(--md-sys-typescale-body-medium-size);
  --md-list-item-label-text-weight: 500;
  --md-list-item-supporting-text-font: var(--font-family-base);
  --md-list-item-supporting-text-size: var(--md-sys-typescale-body-small-size);
  --md-list-item-two-line-container-height: 56px;
  --md-list-item-hover-state-layer-color: var(--md-sys-color-on-surface);
  --md-list-item-hover-state-layer-opacity: 0.08;
  --md-list-item-focus-state-layer-color: var(--md-sys-color-on-surface);
  --md-list-item-focus-state-layer-opacity: 0.12;
}

/* 选中状态的结果项 */
.result-list md-list-item.result-item--selected {
  --md-list-item-container-color: var(--md-sys-color-surface-variant);
}

/* 结果项标题样式 */
.result-headline {
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 结果项 URL 样式 */
.result-url {
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 结果项 favicon 样式 */
.result-favicon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
}

.favicon-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  border-radius: 4px;
}

/* 结果项右侧操作按钮 */
.result-action-btn {
  --md-icon-button-icon-color: var(--color-text-tertiary);
  --md-icon-button-state-layer-shape: var(--radius-sm);
  --md-icon-button-icon-size: 14px;

  opacity: 0;
  transition: opacity 0.2s ease;
}

.result-action-btn:hover {
  --md-icon-button-icon-color: var(--color-primary);
}

/* hover 时显示操作按钮 */
.result-list md-list-item:hover .result-action-btn,
.result-list md-list-item.result-item--selected .result-action-btn {
  opacity: 1;
}

/* 底部提示（当结果 > 50 时显示） */
.more-results-hint {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  border-top: 1px solid var(--color-border-subtle);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  background: var(--color-background);
}

/* 统计信息（在面板内） */
.search-stats {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--border-radius-sm);
  font-size: var(--text-xs);
  white-space: nowrap;
  color: var(--color-text-secondary);
  background: var(--color-background);
}

.stats-time {
  color: var(--color-text-tertiary);
}

/* 错误提示（绝对定位在搜索框下方） */
.search-error {
  position: absolute;
  top: calc(100% + 8px); /* 在搜索框下方 8px */
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  max-width: 280px;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-error);
  border-radius: var(--border-radius-md);
  font-size: var(--text-xs);
  background: var(--color-error-subtle);
  box-shadow: 0 2px 4px var(--color-shadow-010);
}

.error-text {
  flex: 1;
  color: var(--color-error-emphasis);
}

/* 搜索历史面板 */
.search-history-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--spacing-1);
}

.history-title {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.history-clear-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-2);
  border: none;
  border-radius: var(--border-radius-sm);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-clear-btn:hover {
  color: var(--color-error);
  background: var(--color-error-alpha-5);
}

.history-list {
  border-radius: var(--radius-md);
  overflow: hidden;
}

.history-count {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Material Web List 样式 */
.history-list md-list {
  --md-list-container-color: transparent;
}

.history-list md-list-item {
  --md-list-item-label-text-color: var(--md-sys-color-on-surface);
  --md-list-item-supporting-text-color: var(--md-sys-color-on-surface-variant);
  --md-list-item-container-shape: var(--radius-sm);
  --md-list-item-label-text-font: var(--font-family-base);
  --md-list-item-label-text-size: var(--md-sys-typescale-body-medium-size);
  --md-list-item-supporting-text-font: var(--font-family-base);
  --md-list-item-supporting-text-size: var(--md-sys-typescale-body-small-size);
  --md-list-item-one-line-container-height: 40px;
  --md-list-item-hover-state-layer-color: var(--md-sys-color-on-surface);
  --md-list-item-hover-state-layer-opacity: 0.08;
}

.history-list md-icon-button {
  --md-icon-button-icon-color: var(--color-text-tertiary);
  --md-icon-button-state-layer-shape: var(--radius-sm);
  --md-icon-button-icon-size: 14px;
}

.history-list md-icon-button:hover {
  --md-icon-button-icon-color: var(--color-error);
}

/* 快捷筛选标签容器（在面板内） */
.filter-quick-tags {
  display: grid;
  gap: var(--spacing-2);
  grid-template-columns: 1fr 1fr;
}

/* 单个筛选标签按钮 */
.filter-tag {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-1);
  width: 100%;
  min-height: 32px;
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  font-size: var(--text-xs);
  white-space: nowrap;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  cursor: pointer;
  transition:
    background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.filter-tag:hover {
  border-color: var(--color-primary);
  color: var(--color-text);
  background: var(--color-bg-hover);
  box-shadow: 0 1px 3px var(--color-shadow-010);
}

.filter-tag.active {
  border-color: var(--color-primary);
  font-weight: 500;
  color: var(--color-text-on-primary);
  background: var(--color-primary);
  box-shadow: 0 2px 4px var(--color-primary-alpha-30);
}

.filter-tag.active:hover {
  border-color: var(--color-primary-hover);
  background: var(--color-primary-hover);
}

.filter-tag .filter-label {
  flex: 1;
  font-weight: 500;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 激活状态下覆盖 Chip 样式 */
.filter-tag.active .filter-count {
  --md-assist-chip-label-text-color: var(--color-text-on-primary);
  --md-assist-chip-container-color: var(--color-on-primary-faint-025);
}

/* 过渡动画 */
.panel-fade-enter-active,
.panel-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

/* 入场：从上方向下渐入 */
.panel-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

/* 离场：向上渐出 */
.panel-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* 错误提示动画 */
.error-fade-enter-active,
.error-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.error-fade-enter-from,
.error-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
