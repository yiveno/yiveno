<!--
  🌳 性能优化版书签目录树组件
  
  优化策略：
  1. 使用 shallowRef 减少深度响应式开销
  2. 使用 computed 缓存复杂计算
  3. 使用 v-memo 优化列表渲染
  4. 优化事件处理函数
-->

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, shallowRef } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { ContextMenu, EmptyState, Input, Loading, SkeletonTree } from '@/components'
import { LucideIcon } from '@/components/base/LucideIcon'
import type { BookmarkNode } from '@/types'
import { logger } from '@/infrastructure/logging/logger'
import TreeNode from './TreeNode.vue'
import VirtualFolderList from './VirtualFolderList.vue'
import { message } from '@/application/message/message-service'
import { t } from '@/utils/i18n-helpers'
import { ContextMenuBuilder } from '@/core/bookmark/context-menu-config'
import type { MenuItemConfig } from '@/core/bookmark/context-menu-config'
import { useUIStore } from '@/stores/ui-store'

// ✅ 明确组件名称，便于 Vue DevTools 与日志追踪
defineOptions({ name: 'BookmarkTree' })

// ✅ 组件默认值集中在此，便于统一维护
const props = withDefaults(defineProps<Props>(), {
  height: '400px',
  searchable: false,
  selectable: false,
  editable: false,
  strictChromeOrder: false,
  virtual: false,
  size: 'comfortable',
  showToolbar: true,
  toolbarExpandCollapse: true,
  source: 'sidePanel',
  highlightMatches: true,
  showSelectionCheckbox: false,
  accordionMode: false,
  showFavoriteButton: false,
  showEditButton: false,
  showDeleteButton: false,
  showAddButton: false,
  showOpenNewTabButton: false,
  showCopyUrlButton: false,
  showShareButton: false,
  showMoreButton: true,
  draggable: false,
  defaultOpenMode: 'new-tab-background',
  clickBehavior: 'both',
  showBookmarkUrl: true
})

// === Emits 定义 ===
// ✅ 组件对外事件统一声明，用中文说明触发时机
const emit = defineEmits<{
  (e: 'nodeClick', node: BookmarkNode, event: MouseEvent): void
  (e: 'folderToggle', folderId: string, node: BookmarkNode, expanded: boolean): void
  (e: 'nodeSelect', nodeId: string, node: BookmarkNode, selected: boolean): void
  (e: 'selectionChange', ids: string[], nodes: BookmarkNode[]): void
  (e: 'search', query: string): void
  (e: 'ready'): void
  (e: 'nodeEdit', node: BookmarkNode): void
  (e: 'nodeDelete', node: BookmarkNode): void
  (e: 'bookmarkOpenNewTab', node: BookmarkNode): void
  (e: 'bookmarkCopyUrl', node: BookmarkNode): void
  (e: 'bookmarkToggleFavorite', node: BookmarkNode, isFavorite: boolean): void
  (e: 'bookmarkShare', node: BookmarkNode): void
  (e: 'folderShare', node: BookmarkNode): void
  (e: 'nodeHover', node: BookmarkNode): void
  (e: 'nodeHoverLeave', node: BookmarkNode): void
  (e: 'expandStateChange', expanded: boolean): void
  (
    e: 'requestChildren',
    payload: {
      folderId: string
      node: BookmarkNode
      limit: number
      offset: number
    }
  ): void
  (
    e: 'requestMoreChildren',
    payload: {
      folderId: string
      node: BookmarkNode
      limit: number
      loaded: number
    }
  ): void
  (e: 'requestClearFilters'): void
  (
    e: 'bookmarkMove',
    payload: {
      sourceId: string
      targetId: string
      position: 'before' | 'inside' | 'after'
    }
  ): void
  (e: 'descCountsUpdated', counts: Map<string, number>): void
}>()

// 使用 UI Store 管理高亮状态
const uiStore = useUIStore()

// === Props 定义 ===
/**
 * 🌳 书签树组件支持的属性集合
 *
 * ⚠️ 架构原则：纯 UI 组件
 * - 所有数据必须通过 props 传入
 * - 不允许组件内部访问 store
 * - 业务逻辑在页面层处理
 */
interface Props {
  /** 书签树节点数据（必需） */
  nodes: BookmarkNode[]
  /** 是否正在加载 */
  loading?: boolean
  /** 树的高度 */
  height?: string | number
  /** 是否可搜索 */
  searchable?: boolean
  /** 是否可选择 */
  selectable?: boolean | 'single' | 'multiple'
  editable?: boolean
  /** 严格按 Chrome API 原始树的结构与顺序渲染（不做去重/重排） */
  strictChromeOrder?: boolean
  /** 是否启用虚拟滚动 */
  virtual?: boolean | { enabled: boolean; itemHeight?: number; threshold?: number }
  /** 树的尺寸 */
  size?: 'compact' | 'comfortable' | 'spacious'
  /** 是否显示工具栏 */
  showToolbar?: boolean
  /** 是否显示工具栏中的"展开所有/收起所有"按钮 */
  toolbarExpandCollapse?: boolean

  /** 数据来源上下文，用于组件内部决定调用哪个页面级API。 */
  source?: 'sidePanel' | 'management'
  /** 是否在标题中高亮匹配关键字 */
  highlightMatches?: boolean
  /** 是否在书签前显示选择复选框（仅书签节点） */
  showSelectionCheckbox?: boolean
  /**
   * 手风琴模式：展开一个文件夹时自动收起同级的其他文件夹
   * @default false
   */
  accordionMode?: boolean
  /**
   * 独立按钮控制（细粒度配置）
   * 当 editable=false 时，仍然可以单独启用某些操作按钮
   */
  /** 是否显示收藏按钮 */
  showFavoriteButton?: boolean
  /** 是否显示编辑按钮 */
  showEditButton?: boolean
  /** 是否显示删除按钮 */
  showDeleteButton?: boolean
  /** 是否显示添加按钮（文件夹） */
  showAddButton?: boolean
  /** 是否显示打开新标签页按钮 */
  showOpenNewTabButton?: boolean
  /** 是否显示复制链接按钮 */
  showCopyUrlButton?: boolean
  /** 是否显示分享按钮（文件夹） */
  showShareButton?: boolean
  /** 是否显示"更多操作"按钮（三个点） */
  showMoreButton?: boolean
  /**
   * 选中后代计数映射（可选）
   * - 用于显示文件夹包含多少已选中的子节点
   * - 如不需要此功能，可不传或传入空 Map
   */
  selectedDescCounts?: Map<string, number> | undefined
  /**
   * 是否启用拖拽功能
   * @default false
   */
  draggable?: boolean | undefined
  /**
   * 点击书签的默认打开方式
   * - 'new-tab-background': 新标签页打开（后台）- 默认
   * - 'new-tab-foreground': 新标签页打开（前台）
   * - 'current-tab': 当前标签页打开
   * @default 'new-tab-background'
   */
  defaultOpenMode?: 'new-tab-background' | 'new-tab-foreground' | 'current-tab' | undefined
  /**
   * 点击书签的行为模式
   * - 'select': 只选中，不打开（用于批量操作场景，如 Popup）
   * - 'open': 直接打开并高亮（用于浏览场景，如 SidePanel）
   * - 'both': 单击选中，双击打开（默认）
   * @default 'both'
   */
  clickBehavior?: 'select' | 'open' | 'both' | undefined
  /**
   * 是否显示书签 URL（hover 时显示）
   * @default true
   */
  showBookmarkUrl?: boolean | undefined
}

// === 响应式状态 ===
// 🚀 性能优化：使用 shallowRef 减少深度响应式开销
const searchQuery = ref('')

// ✅ 展开/收起状态：完全由组件内部管理（纯 UI 状态）
const expandedFolders = shallowRef(new Set<string>())

// ✅ 选择状态：完全由组件内部管理（纯 UI 状态）
const selectedNodes = shallowRef(new Set<string>())

// ✅ 拖拽状态
const dragState = ref<{
  isDragging: boolean
  dragSourceId: string | null
  dropTargetId: string | null
  dropPosition: 'before' | 'inside' | 'after' | null
}>({
  isDragging: false,
  dragSourceId: null,
  dropTargetId: null,
  dropPosition: null
})

// ✅ 使用 computed 从 UI Store 获取激活状态（SidePanel 当前页面高亮）
const activeNodeId = computed({
  get: () => uiStore.activeBookmarkId,
  set: (value: string | null) => uiStore.setActiveBookmark(value)
})

// ✅ 使用 computed 从 UI Store 获取键盘导航焦点状态（根据 source 区分）
const focusedNodeId = computed({
  get: () => {
    // 根据 source 返回对应面板的焦点状态
    return props.source === 'sidePanel'
      ? uiStore.focusedBookmarkIdSidePanel
      : uiStore.focusedBookmarkIdPopup
  },
  set: (value: string | null) => {
    // 根据 source 设置对应面板的焦点状态
    if (props.source === 'sidePanel') {
      uiStore.setFocusedBookmarkSidePanel(value)
    } else {
      uiStore.setFocusedBookmarkPopup(value)
    }
  }
})

const containerRef = ref<HTMLDivElement | null>(null)
const isOverlayLoading = ref(false)
// 节点根元素注册表：避免滚动定位时反复 querySelector
const nodeElRegistry = new Map<string, HTMLElement>()
// 滚动状态标记，避免并发滚动
const isScrolling = ref(false)
// 自动加载相关状态
const loadingMoreFolders = shallowRef(new Set<string>())

// ✅ 全局右键菜单状态
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuItems = ref<MenuItemConfig[]>([])
const contextMenuNode = ref<BookmarkNode | null>(null)
// ✅ 当前打开菜单的节点 ID（用于保持 hover 状态）
const contextMenuNodeId = ref<string | null>(null)

// 📊 选中后代计数：直接使用 props
const selectedDescCountsState = computed(() => props.selectedDescCounts)

// === 计算属性 ===

// 🚀 loading 状态
const loading = computed(() => props.loading ?? false)

// 🌲 统一获取当前渲染所使用的节点列表
const treeSource = computed(() => {
  // ✅ 纯 UI 组件：直接使用传入的 nodes
  // 空 nodes 是合法的 UI 状态（初始化、无数据、搜索无结果等），不需要警告
  return props.nodes
})

// 🚀 性能优化：缓存树配置对象
const treeConfig = computed(() => ({
  size: props.size,
  searchable: props.searchable,
  selectable: props.selectable,
  editable: props.editable,
  showSelectionCheckbox: props.showSelectionCheckbox,
  draggable: props.draggable, // ✅ 拖拽功能配置
  showBookmarkUrl: props.showBookmarkUrl, // ✅ 是否显示书签 URL
  // 细粒度按钮控制
  showFavoriteButton: props.showFavoriteButton,
  showEditButton: props.showEditButton,
  showDeleteButton: props.showDeleteButton,
  showAddButton: props.showAddButton,
  showOpenNewTabButton: props.showOpenNewTabButton,
  showCopyUrlButton: props.showCopyUrlButton,
  showShareButton: props.showShareButton,
  showMoreButton: props.showMoreButton
}))

// 🚀 性能优化：缓存虚拟滚动配置
interface VirtualConfig {
  enabled: boolean
  itemHeight?: number | undefined
  threshold?: number | undefined
}
const normalizedVirtual = computed<VirtualConfig>(() => {
  if (typeof props.virtual === 'object' && props.virtual) {
    return {
      enabled: !!props.virtual.enabled,
      itemHeight: props.virtual.itemHeight,
      threshold: props.virtual.threshold
    }
  }
  return { enabled: !!props.virtual, threshold: 500 }
})

/**
 * 固定节点高度映射：通过约束节点布局，确保虚拟滚动定位稳定。
 */
const TREE_ITEM_HEIGHT_MAP: Record<'compact' | 'comfortable' | 'spacious', number> = {
  compact: 30,
  comfortable: 36,
  spacious: 44
}
const LARGE_FOLDER_THRESHOLD = 2000

const virtualEnabled = computed(() => {
  const cfg = normalizedVirtual.value
  if (props.strictChromeOrder) return false
  if (cfg.enabled) return true
  const threshold = cfg.threshold ?? 500
  const count = countAllNodes(treeSource.value)
  return count > threshold
})

const itemHeight = computed(() => {
  const cfg = normalizedVirtual.value
  if (cfg.itemHeight) return cfg.itemHeight
  return TREE_ITEM_HEIGHT_MAP[props.size] ?? TREE_ITEM_HEIGHT_MAP.comfortable
})

/**
 * 动态计算 overscan，缓解滚动空白与额外渲染开销之间的冲突。
 */
const virtualOverscan = computed(() => {
  const containerHeight = containerRef.value?.clientHeight ?? TREE_ITEM_HEIGHT_MAP.comfortable * 12
  const rowsInView = Math.max(Math.ceil(containerHeight / itemHeight.value), 1)
  return Math.max(Math.min(rowsInView * 3, 120), 24)
})

// 🚀 性能优化：缓存样式类
const treeClasses = computed(() => ({
  [`tree--${props.size}`]: true,
  'tree--virtual': virtualEnabled.value,
  'tree--loading': loading.value
}))

// 🚀 性能优化：缓存容器样式
const containerStyles = computed(() => {
  const height = typeof props.height === 'number' ? `${props.height}px` : props.height
  return {
    height,
    overflowY: virtualEnabled.value ? ('auto' as const) : ('scroll' as const)
  }
})

// 🚀 性能优化：缓存过滤后的节点
// 🔍 根据搜索条件过滤节点，保持树结构不破坏
const filteredNodes = computed(() => {
  try {
    const source = treeSource.value

    const base = !searchQuery.value
      ? source
      : filterNodes(source as unknown as BookmarkNode[], searchQuery.value)
    return Array.isArray(base) ? base : []
  } catch {
    return []
  }
})

// 🎨 是否显示空状态
const shouldShowEmptyState = computed(() => {
  // 加载中不显示空状态
  if (loading.value) return false
  // 有数据不显示空状态
  if (filteredNodes.value.length > 0) return false
  // 没有数据时显示空状态
  return true
})

// 🎨 空状态配置
const emptyStateConfig = computed(() => {
  const hasSearchQuery = searchQuery.value.trim().length > 0
  const hasSourceData = (props.nodes?.length ?? 0) > 0

  if (hasSearchQuery) {
    // 搜索无结果
    return {
      icon: 'search',
      title: '未找到匹配的书签',
      description: `没有找到与"${searchQuery.value}"相关的书签，试试其他关键词吧`
    }
  }

  if (!hasSourceData) {
    // 真的没有书签
    return {
      icon: 'folder',
      title: '暂无书签'
      // description: '没有找到任何书签，请添加书签'
    }
  }

  // 其他情况（理论上不应该到这里）
  return {
    icon: 'folder',
    title: '暂无数据',
    description: ''
  }
})

watch(
  () => treeSource.value,
  async () => {
    if (virtualEnabled.value) {
      // 等待 DOM 更新并确保有数据后再滚动
      await nextTick()
      if (flattenedItems.value.length > 0) {
        try {
          virtualizer.value?.scrollToIndex(0, { align: 'start' })
        } catch {
          // 虚拟滚动器还未准备好，忽略错误
        }
      }
    }
  }
)

const flattenedItems = computed(() => {
  if (!virtualEnabled.value) return []
  return flattenNodes(filteredNodes.value, expandedFolders.value)
})

// 🚀 性能优化：缓存扁平化节点
type FlattenedItem =
  | {
      kind: 'node'
      id: string
      node: BookmarkNode
      level: number
    }
  | {
      kind: 'chunk'
      id: string
      chunk: {
        parentId: string
        items: BookmarkNode[]
      }
      level: number
    }

/**
 * S-树虚拟化：仅扁平化当前可视路径，避免整棵树递归展开。
 */
function flattenNodes(
  nodes: BookmarkNode[] | unknown,
  expanded: Set<string>,
  level = 0,
  ancestors: Set<string> = new Set()
): FlattenedItem[] {
  const result: FlattenedItem[] = []
  const arr = Array.isArray(nodes) ? (nodes as BookmarkNode[]) : []
  for (const node of arr) {
    if (!node || typeof node !== 'object') continue
    const nodeId = String(node.id)
    result.push({ kind: 'node', id: nodeId, node, level })

    const isExpanded = expanded.has(nodeId)
    if (!isExpanded) continue

    if (ancestors.has(nodeId)) {
      continue
    }
    ancestors.add(nodeId)
    const children = (node as BookmarkNode).children
    if (Array.isArray(children) && children.length) {
      if (children.length > LARGE_FOLDER_THRESHOLD) {
        const chunkSize = Math.max(Math.floor(LARGE_FOLDER_THRESHOLD / 4), 400)
        for (let index = 0; index < children.length; index += chunkSize) {
          const slice = children.slice(index, index + chunkSize)
          result.push({
            kind: 'chunk',
            id: `${nodeId}-chunk-${index}`,
            chunk: { parentId: nodeId, items: slice },
            level: level + 1
          })
        }
      } else {
        result.push(...flattenNodes(children, expanded, level + 1, ancestors))
      }
    }

    ancestors.delete(nodeId)
  }
  return result
}

function countAllNodes(nodes: BookmarkNode[] | unknown): number {
  const arr = Array.isArray(nodes) ? (nodes as BookmarkNode[]) : []
  let total = 0
  for (const n of arr) {
    total++
    if (Array.isArray(n.children) && n.children.length) {
      total += countAllNodes(n.children)
    }
  }
  return total
}

function getAllFolderIds(nodes: BookmarkNode[]): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    if (node.children) {
      ids.push(node.id)
      ids.push(...getAllFolderIds(node.children))
    }
  }
  return ids
}

/**
 * 聚合当前选中节点列表，供事件回调使用
 */
function getSelectedNodes(): BookmarkNode[] {
  const result: BookmarkNode[] = []
  const find = (nodes: BookmarkNode[]) => {
    for (const node of nodes) {
      if (selectedNodes.value.has(node.id)) {
        result.push(node)
      }
      if (node.children) {
        find(node.children)
      }
    }
  }
  find(treeSource.value)
  return result
}

// === TanStack Virtualizer ===
// 🌀 初始化虚拟滚动器，减少 DOM 渲染压力
const virtualizer = useVirtualizer(
  computed(() => ({
    count: flattenedItems.value.length,
    getScrollElement: () => containerRef.value,
    estimateSize: () => itemHeight.value,
    overscan: virtualOverscan.value
  }))
)

let rafId: number | null = null
const lastKnownScrollTop = ref(0)

interface VirtualRow {
  start: number
  size: number
  record: FlattenedItem
}

/**
 * 虚拟滚动行计算
 */
const virtualRows = computed<VirtualRow[]>(() => {
  const rows: VirtualRow[] = []
  const items = virtualizer.value.getVirtualItems()
  const source = flattenedItems.value
  for (const item of items) {
    const record = source[item.index]
    if (!record) continue
    rows.push({ start: item.start, size: item.size, record })
  }
  return rows
})

// 📏 计算虚拟滚动总高度，供 spacer 占位
const totalHeight = computed(() => virtualizer.value.getTotalSize())

function scheduleVirtualizerUpdate() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    virtualizer.value.measure()
  })
}

// === 性能优化：缓存状态检查函数 ===
// ✅ 移除了 v-memo，不再需要这些辅助函数

// === 事件处理 ===
// 🚀 性能优化：使用箭头函数避免重复创建
const handleNodeClick = async (node: BookmarkNode, event: MouseEvent) => {
  const nodeId = String(node.id)

  // ✅ 点击节点时设置键盘导航焦点（而不是选中）
  focusedNodeId.value = nodeId

  logger.debug('BookmarkTree', '点击节点，设置焦点', {
    nodeId,
    title: node.title,
    focusedNodeId: focusedNodeId.value
  })
  // 根据 clickBehavior 决定行为
  if (props.clickBehavior === 'open') {
    // SidePanel 模式：直接打开并高亮
    if (node.url) {
      // 设置激活状态（通过 UI Store）
      uiStore.setActiveBookmark(nodeId)

      // 打开书签
      await openBookmark(node, event)
    }
  } else if (props.clickBehavior === 'select') {
    // Popup 模式：只选中，不打开
    handleNodeSelect(nodeId, node)
  } else {
    // 默认 'both' 模式：设置焦点，不自动选中
    // 选中操作由复选框或 Shift+点击触发
  }

  // 触发事件通知父组件（用于额外处理，如更新访问记录）
  emit('nodeClick', node, event)
}

/**
 * 打开书签
 * @description 根据 defaultOpenMode 和快捷键决定打开方式
 */
const openBookmark = async (node: BookmarkNode, event: MouseEvent) => {
  if (!node.url) return

  const isCtrlOrCmd = event.ctrlKey || event.metaKey
  const isShift = event.shiftKey

  try {
    // 快捷键优先级高于 defaultOpenMode
    if (isCtrlOrCmd) {
      // Ctrl/Cmd + 点击：新标签页打开（前台）
      await chrome.tabs.create({ url: node.url, active: true })
    } else if (isShift) {
      // Shift + 点击：新标签页打开（后台）
      await chrome.tabs.create({ url: node.url, active: false })
    } else {
      // 根据 defaultOpenMode 决定
      switch (props.defaultOpenMode) {
        case 'current-tab': {
          // 在当前标签页打开
          const tabs = await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true
          })
          if (tabs[0]?.id) {
            await chrome.tabs.update(tabs[0].id, { url: node.url })
          } else {
            // 降级：创建新标签页
            await chrome.tabs.create({ url: node.url, active: true })
          }
          break
        }
        case 'new-tab-foreground':
          // 新标签页打开（前台）
          await chrome.tabs.create({ url: node.url, active: true })
          break
        case 'new-tab-background':
        default:
          // 新标签页打开（后台）
          await chrome.tabs.create({ url: node.url, active: false })
          break
      }
    }
  } catch (error) {
    logger.error('BookmarkTree', '打开书签失败', error)
  }
}

const handleFolderToggle = (folderId: string, node: BookmarkNode) => {
  const isExpanded = expandedFolders.value.has(folderId)
  logger.debug('SimpleBookmarkTree', 'handleFolderToggle', {
    folderId,
    title: node.title,
    isExpanded,
    accordionMode: props.accordionMode,
    childrenLoaded: node._childrenLoaded,
    childrenLength: Array.isArray(node.children) ? node.children.length : 0,
    childrenCount: node.childrenCount
  })

  if (isExpanded) {
    // 收起文件夹
    expandedFolders.value.delete(folderId)
  } else {
    // 展开文件夹

    // 🎯 手风琴模式：展开时收起同级的其他文件夹
    if (props.accordionMode) {
      // ✅ 优化：只查找直接兄弟节点，避免遍历整个树
      const parentId = node.parentId || '0'

      // 查找父节点
      const findParentNode = (nodes: BookmarkNode[]): BookmarkNode | null => {
        for (const n of nodes) {
          if (n.id === parentId) return n
          if (n.children && n.children.length > 0) {
            const found = findParentNode(n.children)
            if (found) return found
          }
        }
        return null
      }

      // 获取父节点的所有子节点（即当前节点的兄弟节点）
      let siblings: BookmarkNode[] = []
      if (parentId === '0') {
        // 根节点的子节点就是 props.nodes
        siblings = props.nodes
      } else {
        // 查找父节点
        const parentNode = findParentNode(props.nodes)
        if (parentNode && parentNode.children) {
          siblings = parentNode.children
        }
      }

      // 收起所有同级的已展开文件夹（排除当前节点）
      for (const sibling of siblings) {
        if (sibling.id !== folderId && !sibling.url && expandedFolders.value.has(sibling.id)) {
          expandedFolders.value.delete(sibling.id)
          logger.debug('SimpleBookmarkTree', '📁 手风琴模式：收起同级文件夹', sibling.id)
        }
      }
    }

    // 展开当前文件夹
    expandedFolders.value.add(folderId)
    // ✅ 数据已完整加载，无需懒加载
  }

  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)

  emit('folderToggle', folderId, node, !isExpanded)
}

// === 自动加载功能 ===
// 设置滚动自动加载
const setupScrollAutoLoad = () => {
  if (!containerRef.value) return

  const handleScroll = () => {
    if (!containerRef.value) return

    const { scrollTop } = containerRef.value
    lastKnownScrollTop.value = scrollTop
    scheduleVirtualizerUpdate()
    // ✅ 数据已完整加载，无需懒加载
  }

  containerRef.value.addEventListener('scroll', handleScroll, {
    passive: true
  })
}

// === 键盘导航功能 ===
/**
 * 获取所有可见的节点 ID 列表（按显示顺序）
 */
const getVisibleNodeIds = (): string[] => {
  const ids: string[] = []

  const traverse = (nodes: BookmarkNode[]) => {
    for (const node of nodes) {
      ids.push(String(node.id))

      // 如果是展开的文件夹，递归添加子节点
      if (!node.url && expandedFolders.value.has(String(node.id)) && node.children) {
        traverse(node.children)
      }
    }
  }

  const source = filteredNodes.value
  if (Array.isArray(source)) {
    traverse(source as BookmarkNode[])
  }

  return ids
}

/**
 * 处理键盘导航
 */
// eslint-disable-next-line complexity -- 键盘导航需要处理多个按键，复杂度较高但逻辑清晰
const handleKeyboardNavigation = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  if (!target) {
    return
  }

  // 真实焦点可能在 Material Web 的 Shadow 内；仅判断 event.target 会漏掉宿主上的事件重定向
  const deep = event.composedPath()[0]
  if (deep instanceof HTMLInputElement || deep instanceof HTMLTextAreaElement) {
    return
  }
  if (typeof target.closest === 'function' && target.closest('md-checkbox')) {
    return
  }

  const visibleIds = getVisibleNodeIds()
  if (visibleIds.length === 0) return

  // ✅ 使用 focusedNodeId 而不是 activeNodeId
  const currentIndex = focusedNodeId.value ? visibleIds.indexOf(String(focusedNodeId.value)) : -1

  switch (event.key) {
    case 'ArrowDown': {
      // 下移焦点
      event.preventDefault()
      event.stopPropagation()

      const nextIndex = currentIndex < visibleIds.length - 1 ? currentIndex + 1 : 0
      const nextId = visibleIds[nextIndex]
      focusedNodeId.value = nextId ?? null

      // 滚动到可见区域
      if (nextId) {
        scrollToNode(nextId)
      }
      break
    }

    case 'ArrowUp': {
      // 上移焦点
      event.preventDefault()
      event.stopPropagation()

      const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleIds.length - 1
      const prevId = visibleIds[prevIndex]
      focusedNodeId.value = prevId ?? null

      // 滚动到可见区域
      if (prevId) {
        scrollToNode(prevId)
      }
      break
    }

    case 'ArrowRight': {
      // 文件夹：切换展开/收起；书签：显示操作菜单
      if (focusedNodeId.value) {
        event.preventDefault()
        event.stopPropagation()

        const node = findNodeById(focusedNodeId.value)
        if (node) {
          if (!node.url) {
            // 是文件夹：切换展开/收起状态
            handleFolderToggle(String(node.id), node)
          } else {
            // 是书签：显示操作菜单
            openNodeContextMenu(String(node.id))
          }
        }
      }
      break
    }

    case 'ArrowLeft': {
      // 优先处理：如果右键菜单打开，关闭菜单
      if (showContextMenu.value) {
        event.preventDefault()
        event.stopPropagation()
        closeContextMenu()
        break
      }

      // 文件夹：收起；书签：移动到父节点
      if (focusedNodeId.value) {
        const node = findNodeById(focusedNodeId.value)
        if (node) {
          if (!node.url) {
            // 是文件夹
            // eslint-disable-next-line max-depth -- 键盘导航的嵌套逻辑由按键处理决定，无法简化
            if (expandedFolders.value.has(String(node.id))) {
              // 已展开，收起它
              event.preventDefault()
              event.stopPropagation()
              handleFolderToggle(String(node.id), node)
            } else if (node.parentId && node.parentId !== '0') {
              // 未展开，移动到父节点
              event.preventDefault()
              event.stopPropagation()
              focusedNodeId.value = String(node.parentId)
              scrollToNode(String(node.parentId))
            }
          } else {
            // 是书签：移动到父节点
            if (node.parentId && node.parentId !== '0') {
              event.preventDefault()
              event.stopPropagation()
              focusedNodeId.value = String(node.parentId)
              scrollToNode(String(node.parentId))
            }
          }
        }
      }
      break
    }

    case 'Enter': {
      // 打开书签或展开/收起文件夹
      if (focusedNodeId.value) {
        event.preventDefault()
        event.stopPropagation()

        const node = findNodeById(focusedNodeId.value)
        if (node) {
          if (node.url) {
            // 是书签，打开它
            openBookmark(node, event as unknown as MouseEvent)
          } else {
            // 是文件夹，切换展开/收起
            handleFolderToggle(String(node.id), node)
          }
        }
      }
      break
    }

    case ' ': {
      // 空格键：选中/取消选中
      if (props.selectable && focusedNodeId.value) {
        event.preventDefault()
        event.stopPropagation()

        const node = findNodeById(focusedNodeId.value)
        if (node) {
          handleNodeSelect(String(node.id), node)
        }
      }
      break
    }
  }
}

/**
 * 处理打开右键菜单事件
 */
const handleOpenContextMenu = (nodeId: string, x?: number, y?: number) => {
  // 获取节点数据
  const node = findNodeById(nodeId)
  if (!node) {
    logger.warn('BookmarkTree', '无法找到节点', nodeId)
    return
  }

  // 如果没有提供坐标，使用节点元素的位置
  if (x === undefined || y === undefined) {
    const nodeEl = nodeElRegistry.get(String(nodeId))
    if (!nodeEl) {
      logger.warn('BookmarkTree', '无法找到节点元素', nodeId)
      return
    }
    const rect = nodeEl.getBoundingClientRect()
    x = rect.right - 30
    y = rect.top + rect.height / 2
  }

  // 设置菜单位置
  contextMenuX.value = x
  contextMenuY.value = y

  // 生成菜单项
  contextMenuItems.value = ContextMenuBuilder.buildMenu(node, treeConfig.value, false, [])

  // 保存当前节点引用
  contextMenuNode.value = node
  // ✅ 保存当前节点 ID（用于保持 hover 状态）
  contextMenuNodeId.value = node.id

  // 显示菜单
  showContextMenu.value = true

  logger.debug('BookmarkTree', '打开右键菜单', {
    nodeId: node.id,
    title: node.title,
    isFolder: !node.url
  })
}

/**
 * 打开指定节点的右键菜单（用于键盘导航）
 */
const openNodeContextMenu = (nodeId: string) => {
  // 获取节点数据
  const node = findNodeById(nodeId)
  if (!node) {
    logger.warn('BookmarkTree', '无法找到节点', nodeId)
    return
  }

  // 获取节点的 DOM 元素
  const nodeEl = nodeElRegistry.get(String(nodeId))
  if (!nodeEl) {
    logger.warn('BookmarkTree', '无法找到节点元素', nodeId)
    return
  }

  // 获取节点的位置信息
  const rect = nodeEl.getBoundingClientRect()

  // 调用统一的打开菜单函数
  handleOpenContextMenu(
    nodeId,
    rect.right - 30, // 在节点右侧，稍微往左一点
    rect.top + rect.height / 2 // 垂直居中
  )
}

/**
 * 关闭右键菜单
 */
const closeContextMenu = () => {
  showContextMenu.value = false
  contextMenuNode.value = null
  // ✅ 清除菜单节点 ID
  contextMenuNodeId.value = null

  // ✅ 关闭菜单后，将焦点返回到树容器，确保键盘导航继续工作
  nextTick(() => {
    if (containerRef.value) {
      const treeContainer = containerRef.value.closest('.simple-bookmark-tree') as HTMLElement
      if (treeContainer) {
        treeContainer.focus()
      }
    }
  })
}

/**
 * 处理树级别的键盘事件
 */
const handleTreeKeyDown = (event: KeyboardEvent) => {
  // 右箭头键：打开右键菜单（如果有选中的节点）
  if (event.key === 'ArrowRight' && !showContextMenu.value) {
    const selectedNodeIds = Array.from(selectedNodes.value.keys())
    if (selectedNodeIds.length === 1) {
      const nodeId = selectedNodeIds[0]
      if (nodeId) {
        handleOpenContextMenu(nodeId)
      }
      event.preventDefault()
    }
  }

  // 左箭头键：关闭右键菜单
  if (event.key === 'ArrowLeft' && showContextMenu.value) {
    closeContextMenu()
    event.preventDefault()
  }
}

/**
 * 处理菜单项点击
 */
// eslint-disable-next-line complexity -- switch 语句处理多种菜单操作，逻辑清晰
const handleContextMenuItemClick = (item: MenuItemConfig) => {
  const node = contextMenuNode.value
  if (!node) {
    logger.warn('BookmarkTree', '菜单节点不存在')
    return
  }

  logger.debug('BookmarkTree', '菜单项被点击', {
    action: item.action,
    nodeId: node.id
  })

  // 根据 action 触发对应的事件
  switch (item.action) {
    case 'folder:open-all-incognito':
      openAllBookmarksInFolder(node, 'incognito')
      break
    case 'folder:open-all-tab-group':
      openAllBookmarksInFolder(node, 'tab-group')
      break
    case 'folder:open-all':
      openAllBookmarksInFolder(node, 'current-window')
      break
    case 'folder:open-all-new-window':
      openAllBookmarksInFolder(node, 'new-window')
      break
    case 'folder:edit':
      emit('nodeEdit', node)
      break
    case 'folder:delete':
      emit('nodeDelete', node)
      break
    case 'folder:share':
      emit('folderShare', node)
      break
    case 'bookmark:open-new-tab':
      emit('bookmarkOpenNewTab', node)
      break
    case 'bookmark:copy-url':
      emit('bookmarkCopyUrl', node)
      break
    case 'bookmark:toggle-favorite':
      // 获取当前收藏状态
      const isFavorite = node.isFavorite ?? false
      emit('bookmarkToggleFavorite', node, !isFavorite)
      break
    case 'bookmark:share':
      emit('bookmarkShare', node)
      break
    case 'bookmark:edit':
      emit('nodeEdit', node)
      break
    case 'bookmark:delete':
      emit('nodeDelete', node)
      break
    default:
      logger.warn('BookmarkTree', '未知的菜单操作', item.action)
  }

  closeContextMenu()
}

/**
 * 打开文件夹内的所有书签
 *
 * @param node - 文件夹节点
 * @param mode - 打开模式
 */
const openAllBookmarksInFolder = async (
  node: BookmarkNode,
  mode: 'incognito' | 'tab-group' | 'current-window' | 'new-window'
) => {
  // 递归收集文件夹内的所有书签 URL
  const urls: string[] = []
  const collectUrls = (n: BookmarkNode) => {
    if (n.url) {
      urls.push(n.url)
    } else if (n.children) {
      for (const child of n.children) {
        collectUrls(child)
      }
    }
  }
  collectUrls(node)

  if (urls.length === 0) {
    logger.warn('BookmarkTree', '文件夹内没有书签', node.title)
    message.warning('文件夹内没有书签')
    return
  }

  logger.info('BookmarkTree', `打开文件夹内的 ${urls.length} 个书签`, {
    mode,
    folderTitle: node.title
  })

  try {
    switch (mode) {
      case 'incognito': {
        // 在无痕窗口中打开所有书签
        // ✅ 使用 chrome.windows.create 的 url 数组参数一次性打开所有标签页
        await chrome.windows.create({
          incognito: true,
          url: urls // 直接传入所有 URL 数组
        })

        message.success(`已在无痕窗口中打开 ${urls.length} 个书签`)
        break
      }

      case 'tab-group': {
        // 在新标签页分组中打开
        const currentWindow = await chrome.windows.getCurrent()
        const tabs: chrome.tabs.Tab[] = []

        // 创建所有标签页
        for (const url of urls) {
          const tab = await chrome.tabs.create({
            windowId: currentWindow.id,
            url,
            active: false
          })
          tabs.push(tab)
        }

        // 创建标签页分组
        const tabIds = tabs.map(tab => tab.id).filter((id): id is number => id !== undefined)
        if (tabIds.length > 0) {
          // @ts-expect-error - Chrome API 类型定义问题
          const groupId = await chrome.tabs.group({ tabIds })
          // @ts-expect-error - Chrome API 类型定义问题
          await chrome.tabGroups.update(groupId, {
            title: node.title || '书签文件夹',
            collapsed: false
          })
        }

        message.success(`已在标签页分组中打开 ${urls.length} 个书签`)
        break
      }

      case 'current-window': {
        // 在当前窗口中打开
        const currentWindow = await chrome.windows.getCurrent()

        for (const url of urls) {
          await chrome.tabs.create({
            windowId: currentWindow.id,
            url,
            active: false
          })
        }

        message.success(`已打开 ${urls.length} 个书签`)
        break
      }

      case 'new-window': {
        // 在新窗口中打开所有书签
        // ✅ 使用 chrome.windows.create 的 url 数组参数一次性打开所有标签页
        await chrome.windows.create({
          url: urls // 直接传入所有 URL 数组
        })

        message.success(`已在新窗口中打开 ${urls.length} 个书签`)
        break
      }
    }
  } catch (error) {
    logger.error('BookmarkTree', '打开书签失败', error)
    message.error('打开书签失败')
  }
}

/**
 * 滚动到指定节点
 */
const scrollToNode = (nodeId: string) => {
  const el = nodeElRegistry.get(String(nodeId))
  if (el && containerRef.value) {
    const containerRect = containerRef.value.getBoundingClientRect()
    const nodeRect = el.getBoundingClientRect()

    // 检查节点是否在可见区域内
    const isVisible = nodeRect.top >= containerRect.top && nodeRect.bottom <= containerRect.bottom

    if (!isVisible) {
      // 滚动到节点位置（居中）
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }
}

/**
 * 处理点击树容器外部，清除焦点
 */
const handleClickOutsideTree = (event: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    focusedNodeId.value = null
  }
}

/**
 * 处理点击树容器内部
 */
const handleContainerClick = (event: MouseEvent) => {
  // ✅ 不要阻止事件冒泡，让 ContextMenu 的外部点击监听器可以工作
  // event.stopPropagation() // ❌ 移除这行

  // 如果点击的是右键菜单，不处理
  const target = event.target as HTMLElement
  if (target.closest('.context-menu')) {
    return
  }

  // 如果没有焦点节点，设置第一个节点为焦点
  if (!focusedNodeId.value) {
    const visibleIds = getVisibleNodeIds()
    if (visibleIds.length > 0) {
      focusedNodeId.value = visibleIds[0] ?? null
    }
  }
}

/**
 * 设置键盘导航
 */
const setupKeyboardNavigation = () => {
  if (!containerRef.value) return

  // 使树容器可聚焦
  containerRef.value.setAttribute('tabindex', '0')

  // 添加键盘事件监听
  containerRef.value.addEventListener('keydown', handleKeyboardNavigation)

  // 点击树容器时，如果没有焦点节点，设置第一个节点为焦点
  containerRef.value.addEventListener('click', handleContainerClick)

  // 点击树容器外部时，清除焦点状态
  document.addEventListener('click', handleClickOutsideTree)
}

/**
 * 清理键盘导航
 */
const cleanupKeyboardNavigation = () => {
  if (containerRef.value) {
    containerRef.value.removeEventListener('keydown', handleKeyboardNavigation)
    containerRef.value.removeEventListener('click', handleContainerClick)
  }
  // 清理全局点击监听器
  document.removeEventListener('click', handleClickOutsideTree)
}

/**
 * 在当前树数据中查找指定 ID 的节点
 * - 外部驱动模式需要基于 props.nodes 查询
 */
const findNodeById = (id: string): BookmarkNode | undefined => {
  const source = treeSource.value
  if (!Array.isArray(source)) return undefined
  const search = (nodes: BookmarkNode[]): BookmarkNode | undefined => {
    for (const node of nodes) {
      if (String(node.id) === String(id)) return node
      if (Array.isArray(node.children)) {
        const found = search(node.children)
        if (found) return found
      }
    }
    return undefined
  }
  return search(source as BookmarkNode[])
}

const handleNodeEdit = (node: BookmarkNode) => {
  emit('nodeEdit', node)
}

const handleNodeDelete = (node: BookmarkNode) => {
  emit('nodeDelete', node)
}

const handleFolderShare = (node: BookmarkNode) => {
  emit('folderShare', node)
}

const handleBookmarkOpenNewTab = (node: BookmarkNode) => {
  if (node.url) {
    emit('bookmarkOpenNewTab', node)
  }
}

const handleBookmarkCopyUrl = (node: BookmarkNode) => {
  emit('bookmarkCopyUrl', node)
}

const handleBookmarkToggleFavorite = (node: BookmarkNode, isFavorite: boolean) => {
  emit('bookmarkToggleFavorite', node, isFavorite)
}

// 拖拽事件处理
const handleDragStart = (node: BookmarkNode) => {
  dragState.value.isDragging = true
  dragState.value.dragSourceId = String(node.id)
  logger.debug('BookmarkTree', '开始拖拽', { nodeId: node.id })
}

const handleDragOver = (data: { node: BookmarkNode; position: 'before' | 'inside' | 'after' }) => {
  dragState.value.dropTargetId = String(data.node.id)
  dragState.value.dropPosition = data.position
}

const handleDragLeave = () => {
  dragState.value.dropTargetId = null
  dragState.value.dropPosition = null
}

const handleDrop = (data: {
  sourceId: string
  targetId: string
  position: 'before' | 'inside' | 'after'
}) => {
  logger.info('BookmarkTree', '拖拽放置', data)
  emit('bookmarkMove', data)

  // 重置拖拽状态
  dragState.value.isDragging = false
  dragState.value.dragSourceId = null
  dragState.value.dropTargetId = null
  dragState.value.dropPosition = null
}

const handleDragEnd = () => {
  // 重置拖拽状态
  dragState.value.isDragging = false
  dragState.value.dragSourceId = null
  dragState.value.dropTargetId = null
  dragState.value.dropPosition = null
}

/**
 * 处理节点选择逻辑
 * - 支持单选/多选
 * - 同步维护子节点的选中状态
 */
const handleNodeSelect = (nodeId: string, node: BookmarkNode) => {
  // ✅ 如果禁用了选中功能，直接返回
  if (!props.selectable) {
    logger.debug('BookmarkTree', '选中功能已禁用，忽略选中操作', { nodeId })
    return
  }

  const id = String(nodeId)
  const isSelected = selectedNodes.value.has(id)

  // 递归选中/取消选中所有子孙节点
  const addDescendants = (n: BookmarkNode) => {
    if (n.children && n.children.length) {
      for (const c of n.children) {
        selectedNodes.value.add(String(c.id))
        addDescendants(c)
      }
    }
  }
  const removeDescendants = (n: BookmarkNode) => {
    if (n.children && n.children.length) {
      for (const c of n.children) {
        selectedNodes.value.delete(String(c.id))
        removeDescendants(c)
      }
    }
  }

  // 🆕 向上级联更新父节点选中状态
  const updateAncestors = (currentNode: BookmarkNode, visited: Set<string> = new Set()) => {
    if (!currentNode.parentId) return

    // ⚠️ 防止无限递归：检查是否已访问过此节点
    const currentId = String(currentNode.id)
    if (visited.has(currentId)) {
      logger.warn('BookmarkTree', '检测到循环引用，停止向上更新', {
        nodeId: currentId
      })
      return
    }
    visited.add(currentId)

    // ⚠️ 防止无限递归：限制递归深度
    if (visited.size > 50) {
      logger.warn('BookmarkTree', '递归深度超过限制，停止向上更新', {
        depth: visited.size
      })
      return
    }

    const parentNode = findNodeById(currentNode.parentId)
    if (!parentNode || !parentNode.children || parentNode.children.length === 0) return

    // 检查父节点的所有直接子节点是否都被选中
    const allChildrenSelected = parentNode.children.every(child =>
      selectedNodes.value.has(String(child.id))
    )

    const anyChildSelected = parentNode.children.some(child =>
      selectedNodes.value.has(String(child.id))
    )

    if (allChildrenSelected) {
      // 所有子节点都选中 → 选中父节点
      selectedNodes.value.add(String(parentNode.id))
      // 继续向上检查
      updateAncestors(parentNode, visited)
    } else if (!anyChildSelected) {
      // 所有子节点都未选中 → 取消选中父节点
      selectedNodes.value.delete(String(parentNode.id))
      // 继续向上检查
      updateAncestors(parentNode, visited)
    } else {
      // 部分选中 → 取消选中父节点（会通过 selectedDescCounts 显示半选中）
      selectedNodes.value.delete(String(parentNode.id))
      // 继续向上检查
      updateAncestors(parentNode, visited)
    }
  }

  if (props.selectable === 'single') {
    selectedNodes.value.clear()
    if (!isSelected) {
      selectedNodes.value.add(id)
      if (node.children) addDescendants(node)
    }
  } else if (props.selectable === 'multiple') {
    if (isSelected) {
      // 取消选中：移除该节点及所有子孙节点
      selectedNodes.value.delete(id)
      removeDescendants(node)
      // 🆕 向上更新父节点状态
      updateAncestors(node)
    } else {
      // 选中：添加该节点及所有子孙节点
      selectedNodes.value.add(id)
      addDescendants(node)
      // 🆕 向上更新父节点状态
      updateAncestors(node)
    }
  }

  // ✅ 强制触发响应式更新（Vue 无法自动追踪 Set 内部变化）
  selectedNodes.value = new Set(selectedNodes.value)

  const selected = selectedNodes.value.has(id)
  emit('nodeSelect', id, node, selected)
  emit('selectionChange', Array.from(selectedNodes.value), getSelectedNodes())

  // 基于当前选中集合重算已选后代计数（O(#selected书签 * 平均祖先深度））
  // ✅ 直接修改 props.selectedDescCounts (Map 是引用类型，父组件会自动更新)
  // ✅ 使用完整的 treeSource 而不是 filteredNodes，确保搜索状态下也能正确计算父节点的 indeterminate 状态
  const source = props.nodes || treeSource.value
  const newCounts = new Map<string, number>()

  if (Array.isArray(source)) {
    const traverse = (nodes: BookmarkNode[], ancestors: string[] = []) => {
      for (const current of nodes) {
        const currentId = String(current.id)
        const nextAncestors = current.url ? ancestors : [...ancestors, currentId]

        if (current.url && selectedNodes.value.has(currentId)) {
          for (const ancestorId of ancestors) {
            newCounts.set(ancestorId, (newCounts.get(ancestorId) ?? 0) + 1)
          }
        }

        if (Array.isArray(current.children) && current.children.length) {
          traverse(current.children, nextAncestors)
        }
      }
    }

    traverse(source as BookmarkNode[])
  }

  // ✅ 更新 Map 并触发响应式（通过 emit 让父组件重新赋值）
  if (props.selectedDescCounts) {
    try {
      props.selectedDescCounts?.clear()
      newCounts.forEach((value, key) => {
        props.selectedDescCounts!.set(key, value)
      })
    } catch (error) {
      // ⚠️ 如果 Map 被冻结（例如被 Immer 管理），创建新 Map 并替换
      logger.warn('BookmarkTree', 'selectedDescCounts 被冻结，无法直接修改', {
        error
      })
    }

    // 🔄 通过 emit 通知父组件 Map 已更新（触发响应式）
    emit('descCountsUpdated', new Map(props.selectedDescCounts))
  }
}

// === 工具函数 ===
// 🚀 性能优化：缓存节点元素注册/注销函数
function registerNodeEl(id: string, el: HTMLElement) {
  nodeElRegistry.set(String(id), el)
}

function unregisterNodeEl(id: string) {
  nodeElRegistry.delete(String(id))
}

/**
 * 针对树结构执行搜索过滤
 * - 保证保留命中的节点及其祖先，用于展开展示
 */
function filterNodes(nodes: BookmarkNode[], query: string): BookmarkNode[] {
  const lowerQuery = (query || '').toString().toLowerCase().trim()

  const isTagOnly = lowerQuery.startsWith('tag:') || lowerQuery.startsWith('#')
  const tagTerm = isTagOnly
    ? lowerQuery
        .replace(/^tag:\s*/i, '')
        .replace(/^#/, '')
        .trim()
    : ''

  const matchNode = (n: BookmarkNode): boolean => {
    const titleLower = (n.titleLower || n.title || '').toString().toLowerCase()
    const urlLower = (n.urlLower || n.url || '').toString().toLowerCase()
    const domainLower = (n.domain || '').toLowerCase()
    const tags = n.tags || []
    const hasTagHit = tags.some((tag: string) =>
      tag.toLowerCase().includes(isTagOnly ? tagTerm : lowerQuery)
    )

    if (isTagOnly) return hasTagHit

    return (
      titleLower.includes(lowerQuery) ||
      urlLower.includes(lowerQuery) ||
      domainLower.includes(lowerQuery) ||
      hasTagHit
    )
  }

  const recurse = (arr: BookmarkNode[]): BookmarkNode[] => {
    const out: BookmarkNode[] = []
    for (const n of arr) {
      const matched = matchNode(n)
      const childMatches = n.children ? recurse(n.children) : []
      if (matched || childMatches.length > 0) {
        // 提取嵌套三元运算符为函数
        const getChildren = () => {
          if (childMatches.length) return childMatches
          if (n.url) return undefined
          return []
        }
        out.push({
          ...n,
          children: getChildren()
        })
      }
    }
    return out
  }
  return recurse(nodes)
}

// === 监听器 ===
watch(searchQuery, (newQuery: string) => {
  const trimmed = newQuery?.trim() || ''

  if (trimmed) {
    // 仅展开命中路径：收集命中节点及其祖先
    try {
      const source = treeSource.value
      const matchedIds = new Set<string>()

      const lowerQuery = trimmed.toLowerCase()
      const matchNode = (n: BookmarkNode): boolean => {
        const titleLower = (n.titleLower || n.title || '').toString().toLowerCase()
        const urlLower = (n.urlLower || n.url || '').toString().toLowerCase()
        const domainLower = (n.domain || '').toLowerCase()
        const tags = n.tags || []
        const hasTagHit = tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery))
        return (
          titleLower.includes(lowerQuery) ||
          urlLower.includes(lowerQuery) ||
          domainLower.includes(lowerQuery) ||
          hasTagHit
        )
      }

      const dfs = (arr: BookmarkNode[], ancestors: string[] = []) => {
        for (const n of arr) {
          const childAnc = [...ancestors, n.id]
          if (matchNode(n)) {
            for (const aid of ancestors) matchedIds.add(aid)
          }
          if (n.children && n.children.length) dfs(n.children, childAnc)
        }
      }

      if (Array.isArray(source)) dfs(source)

      expandedFolders.value = new Set(matchedIds)
    } catch {
      // 回退：若出现异常，保持原策略
      expandAll()
    }
  } else {
    collapseAll()
  }

  emit('search', newQuery)
})

// === 生命周期 ===
onMounted(() => {
  emit('ready')
  setupScrollAutoLoad()
  setupKeyboardNavigation()
})

onUnmounted(() => {
  cleanupKeyboardNavigation()
})

// === 暴露的方法 ===
const expandAll = () => {
  const source = treeSource.value
  const allFolderIds = getAllFolderIds(source)
  if (allFolderIds.length > 2000) {
    logger.warn('SimpleBookmarkTree', 'expandAll 被限制，节点过多')
    message.warning('节点过多，展开全部会影响性能，请按需展开。')
    return
  }
  expandedFolders.value = new Set(allFolderIds)
  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)
  emit('expandStateChange', true)
}

const collapseAll = () => {
  expandedFolders.value = new Set()
  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)
  emit('expandStateChange', false)
}

const clearSelection = () => {
  selectedNodes.value = new Set()
  // ✅ 安全地清空 Map（处理可能的 Immer 冻结对象）
  try {
    props.selectedDescCounts?.clear()
  } catch (error) {
    logger.warn('BookmarkTree', 'selectedDescCounts 被冻结，无法清空', {
      error
    })
  }
  emit('selectionChange', [], [])
}

const clearHoverAndActive = () => {
  focusedNodeId.value = null
}

// === 缺失的方法实现 ===
/**
 * 暴露给父组件的聚焦能力
 * 用于程序化地聚焦到某个节点（键盘导航焦点）
 */
const focusNodeById = async (
  id: string,
  options?: {
    scrollIntoView?: boolean
    collapseOthers?: boolean
    scrollIntoViewCenter?: boolean
    pathIds?: string[]
  }
) => {
  // 设置键盘导航焦点
  focusedNodeId.value = id

  if (options?.collapseOthers) {
    // 收起其他文件夹，只保留当前节点
    expandedFolders.value = new Set([id])
    // 强制触发响应式更新
    expandedFolders.value = new Set(expandedFolders.value)
  }

  // 构建需要展开的父节点路径
  let pathIdsToExpand: string[] = []

  if (options?.pathIds && options.pathIds.length > 0) {
    // 优先使用传入的 pathIds（来自 IndexedDB 的预处理数据）
    pathIdsToExpand = options.pathIds
  } else {
    // 降级方案：自己查找并构建路径
    const targetNode = findNodeById(id)
    if (targetNode) {
      pathIdsToExpand = buildParentPath(id)
    }
  }

  // 展开父路径上的所有文件夹
  if (pathIdsToExpand.length > 0) {
    for (const pathId of pathIdsToExpand) {
      expandedFolders.value.add(pathId)
      // ✅ 数据已完整加载，无需懒加载
    }
    // 强制触发响应式更新
    expandedFolders.value = new Set(expandedFolders.value)
  }

  // 滚动操作：非阻塞异步执行
  if (options?.scrollIntoView || options?.scrollIntoViewCenter) {
    nextTick(() => {
      const element = nodeElRegistry.get(id)
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: options?.scrollIntoViewCenter ? 'center' : 'nearest'
        })
      } else {
        requestAnimationFrame(() => {
          const el = nodeElRegistry.get(id)
          if (el) {
            el.scrollIntoView({
              behavior: 'smooth',
              block: options?.scrollIntoViewCenter ? 'center' : 'nearest'
            })
          }
        })
      }
    })
  }
}

/**
 * 构建从根到目标节点的父路径
 * 返回所有需要展开的文件夹 ID 列表（不包含目标节点本身）
 */
const buildParentPath = (targetId: string): string[] => {
  const path: string[] = []
  const source = treeSource.value
  if (!Array.isArray(source)) return path

  // 递归查找节点并记录路径
  const findPath = (nodes: BookmarkNode[], currentPath: string[]): boolean => {
    for (const node of nodes) {
      if (String(node.id) === String(targetId)) {
        // 找到目标节点，返回当前路径（不包含目标节点本身）
        path.push(...currentPath)
        return true
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        // 递归查找子节点
        if (findPath(node.children, [...currentPath, String(node.id)])) {
          return true
        }
      }
    }
    return false
  }

  findPath(source as BookmarkNode[], [])
  return path
}

const expandFolderById = (id: string) => {
  expandedFolders.value.add(id)
  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)
}

const collapseFolderById = (id: string) => {
  expandedFolders.value.delete(id)
  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)
}

const toggleFolderById = (id: string) => {
  if (expandedFolders.value.has(id)) {
    expandedFolders.value.delete(id)
  } else {
    expandedFolders.value.add(id)
  }
  // 强制触发响应式更新
  expandedFolders.value = new Set(expandedFolders.value)
}

const selectNodeById = (id: string, opts?: { append?: boolean }) => {
  const sid = String(id)
  const allowMultiple = props.selectable === 'multiple'
  const append = !!opts?.append
  if (!allowMultiple || !append) {
    selectedNodes.value = new Set()
  }
  selectedNodes.value.add(sid)
  // ✅ 强制触发响应式更新
  selectedNodes.value = new Set(selectedNodes.value)
  emit('selectionChange', Array.from(selectedNodes.value), getSelectedNodes())
}

const selectNodesByIds = (ids: string[], opts?: { append?: boolean }) => {
  const allowMultiple = props.selectable === 'multiple'
  const normalized = ids.map(id => String(id)).filter(Boolean)
  const current = opts?.append ? new Set(selectedNodes.value) : new Set<string>()
  for (const id of normalized) {
    if (!allowMultiple && current.size >= 1) {
      current.clear()
    }
    current.add(id)
    if (!allowMultiple) break
  }
  selectedNodes.value = current
  emit('selectionChange', Array.from(current), getSelectedNodes())

  // ✅ 重新计算选中后代计数
  // ✅ 使用完整的 props.nodes 而不是 filteredNodes，确保搜索状态下也能正确计算父节点的 indeterminate 状态
  const source = props.nodes || treeSource.value
  const newCounts = new Map<string, number>()

  if (Array.isArray(source)) {
    const traverse = (nodes: BookmarkNode[], ancestors: string[] = []) => {
      for (const node of nodes) {
        const nodeId = String(node.id)
        const nextAncestors = node.url ? ancestors : [...ancestors, nodeId]

        if (node.url && current.has(nodeId)) {
          for (const ancestorId of ancestors) {
            newCounts.set(ancestorId, (newCounts.get(ancestorId) ?? 0) + 1)
          }
        }

        if (Array.isArray(node.children) && node.children.length) {
          traverse(node.children, nextAncestors)
        }
      }
    }

    traverse(source)
  }

  // ✅ 安全地更新 Map（处理可能的 Immer 冻结对象）
  try {
    props.selectedDescCounts?.clear()
    newCounts.forEach((value, key) => {
      props.selectedDescCounts?.set(key, value)
    })
  } catch (error) {
    logger.warn('BookmarkTree', 'selectedDescCounts 被冻结，无法直接修改', {
      error
    })
  }
}

const getFirstVisibleBookmarkId = (): string | undefined => {
  const findFirst = (nodes: BookmarkNode[]): string | undefined => {
    for (const n of nodes) {
      if (n.url) return n.id
      if (n.children && n.children.length) {
        const id = findFirst(n.children)
        if (id) return id
      }
    }
    return undefined
  }
  return findFirst(filteredNodes.value)
}

defineExpose({
  expandAll,
  collapseAll,
  clearSelection,
  expandedFolders,
  selectedNodes,
  focusNodeById,
  activeNodeId,
  clearHoverAndActive,
  expandFolderById,
  collapseFolderById,
  toggleFolderById,
  selectNodeById,
  selectNodesByIds,
  getFirstVisibleBookmarkId,
  searchQuery,
  setSearchQuery: (q: string) => {
    searchQuery.value = q
  },
  isScrolling
})
</script>

<template>
  <div class="simple-bookmark-tree" :class="treeClasses" tabindex="0" @keydown="handleTreeKeyDown">
    <!-- 搜索框 (可选) -->
    <div v-if="searchable" class="tree-search">
      <Input
        v-model="searchQuery"
        :placeholder="t('search_placeholder')"
        type="text"
        variant="outlined"
        density="compact"
        clearable
      >
        <template #prepend>
          <LucideIcon name="search" :size="16" />
        </template>
      </Input>
    </div>

    <!-- 树容器 -->
    <div class="tree-container-wrapper">
      <div
        ref="containerRef"
        class="tree-container"
        :class="{ 'is-loading': isOverlayLoading }"
        :style="containerStyles"
      >
        <div v-if="isOverlayLoading" class="tree-loading-overlay">
          <Loading size="lg" text="正在加载书签…" />
        </div>

        <!-- 空状态 -->
        <EmptyState
          v-if="shouldShowEmptyState"
          :icon="emptyStateConfig.icon"
          :title="emptyStateConfig.title"
          v-bind="emptyStateConfig.description ? { description: emptyStateConfig.description } : {}"
          :icon-size="56"
        />

        <!-- 标准渲染模式 -->
        <div v-if="!virtualEnabled && !shouldShowEmptyState" class="standard-content">
          <TreeNode
            v-for="node in filteredNodes"
            :key="node.id"
            :node="node"
            :level="0"
            :expanded-folders="expandedFolders"
            :selected-nodes="selectedNodes"
            :selected-desc-counts="selectedDescCountsState"
            :search-query="searchQuery"
            :highlight-matches="highlightMatches"
            :config="treeConfig"
            :drag-state="dragState"
            :strict-order="props.strictChromeOrder"
            :active-id="activeNodeId"
            :focused-id="focusedNodeId"
            :context-menu-node-id="contextMenuNodeId"
            @node-mounted="registerNodeEl"
            @node-unmounted="unregisterNodeEl"
            @node-click="handleNodeClick"
            @folder-toggle="handleFolderToggle"
            @node-select="handleNodeSelect"
            @node-edit="handleNodeEdit"
            @node-delete="handleNodeDelete"
            @bookmark-open-new-tab="handleBookmarkOpenNewTab"
            @bookmark-copy-url="handleBookmarkCopyUrl"
            @bookmark-toggle-favorite="handleBookmarkToggleFavorite"
            @folder-share="handleFolderShare"
            @drag-start="handleDragStart"
            @drag-over="handleDragOver"
            @drag-leave="handleDragLeave"
            @drop="handleDrop"
            @drag-end="handleDragEnd"
            @open-context-menu="handleOpenContextMenu"
          />
        </div>

        <!-- 虚拟滚动模式 (TanStack Virtual) -->
        <div v-else-if="virtualEnabled && !shouldShowEmptyState" class="virtual-content">
          <div class="virtual-spacer" :style="{ height: `${totalHeight}px` }">
            <div
              v-for="row in virtualRows"
              :key="row.record.id"
              class="virtual-item"
              :style="{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${row.size}px`,
                transform: `translateY(${row.start}px)`
              }"
            >
              <TreeNode
                v-if="row.record.kind === 'node' && row.record.node"
                :node="row.record.node"
                :level="row.record.level"
                :expanded-folders="expandedFolders"
                :selected-nodes="selectedNodes"
                :selected-desc-counts="selectedDescCountsState"
                :search-query="searchQuery"
                :highlight-matches="highlightMatches"
                :config="treeConfig"
                :is-virtual-mode="true"
                :drag-state="dragState"
                :strict-order="props.strictChromeOrder"
                :active-id="activeNodeId"
                :focused-id="focusedNodeId"
                :loading-more-folders="loadingMoreFolders"
                :context-menu-node-id="contextMenuNodeId"
                @node-mounted="registerNodeEl"
                @node-unmounted="unregisterNodeEl"
                @node-click="handleNodeClick"
                @folder-toggle="handleFolderToggle"
                @node-select="handleNodeSelect"
                @node-edit="handleNodeEdit"
                @node-delete="handleNodeDelete"
                @bookmark-open-new-tab="handleBookmarkOpenNewTab"
                @bookmark-copy-url="handleBookmarkCopyUrl"
                @bookmark-toggle-favorite="handleBookmarkToggleFavorite"
                @folder-share="handleFolderShare"
                @drag-start="handleDragStart"
                @drag-over="handleDragOver"
                @drag-leave="handleDragLeave"
                @drop="handleDrop"
                @drag-end="handleDragEnd"
                @open-context-menu="handleOpenContextMenu"
              />
              <VirtualFolderList
                v-else-if="row.record.kind === 'chunk' && row.record.chunk"
                :chunk="row.record.chunk"
                :level="row.record.level"
                :expanded-folders="expandedFolders"
                :selected-nodes="selectedNodes"
                :selected-desc-counts="selectedDescCountsState"
                :search-query="searchQuery"
                :highlight-matches="highlightMatches"
                :config="treeConfig"
                :strict-order="props.strictChromeOrder"
                :active-id="activeNodeId"
                :focused-id="focusedNodeId"
                :loading-more-folders="loadingMoreFolders"
                :size="props.size"
                @node-click="handleNodeClick"
                @folder-toggle="handleFolderToggle"
                @node-select="handleNodeSelect"
                @node-edit="handleNodeEdit"
                @node-delete="handleNodeDelete"
                @bookmark-open-new-tab="handleBookmarkOpenNewTab"
                @bookmark-copy-url="handleBookmarkCopyUrl"
                @bookmark-toggle-favorite="handleBookmarkToggleFavorite"
                @folder-share="handleFolderShare"
              />
            </div>
          </div>
        </div>

        <!-- 加载状态 - 使用骨架屏 -->
        <div v-if="loading && !isOverlayLoading" class="loading-state">
          <SkeletonTree :count="8" :max-level="3" animation="pulse" />
        </div>
      </div>
    </div>

    <!-- 全局右键菜单 -->
    <ContextMenu
      :show="showContextMenu"
      :items="contextMenuItems"
      :x="contextMenuX"
      :y="contextMenuY"
      @item-click="handleContextMenuItemClick"
      @close="closeContextMenu"
    />
  </div>
</template>

<style scoped>
.simple-bookmark-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: var(--border-radius-md);
  background: var(--color-surface);
}

.tree-search {
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.tree-container-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
}

.tree-container {
  position: relative;
  height: 100%;
  border-radius: var(--radius-lg);

  /* ✅ 移除键盘导航时的 focus outline */
  outline: none;
  background: var(--color-surface);
  overflow: auto;
}

.tree-container.is-loading {
  pointer-events: none;
}

.tree-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-2);
  background: color-mix(in srgb, var(--color-surface) 70%, transparent);
}

.tree-loading-text {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.standard-content,
.virtual-content {
  position: relative;
  height: 100%;
}

.virtual-spacer {
  position: relative;
  width: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-xl);
  color: var(--color-text-secondary);
}

.loading-state {
  padding: var(--spacing-3);
}

/* 尺寸变体 */
.tree--compact {
  --item-height: 28px;
  --indent-size: 20px; /* ✅ 增加缩进：16 → 20 */
}

.tree--comfortable {
  --item-height: 32px;
  --indent-size: 24px; /* ✅ 增加缩进：20 → 24 */
}

.tree--spacious {
  --item-height: 40px;
  --indent-size: 32px; /* ✅ 增加缩进：24 → 32 */
}

.tree--loading {
  opacity: 0.6;
  pointer-events: none;
}
</style>
