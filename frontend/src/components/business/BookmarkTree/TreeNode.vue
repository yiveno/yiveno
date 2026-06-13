<!--
  📄 性能优化版书签树节点组件
  
  优化策略：
  1. 使用 shallowRef 减少深度响应式开销
  2. 使用 computed 缓存复杂计算
  3. 使用 v-memo 优化条件渲染
  4. 优化事件处理函数
  5. 减少不必要的响应式数据
-->

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef } from 'vue'
import { LucideIcon } from '@/components/base/LucideIcon'
import type { BookmarkNode } from '@/types'
import { logger } from '@/infrastructure/logging/logger'
import { useLazyFavicon } from '@/composables/useLazyFavicon'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview'
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview'
import { Button } from '@/components'
import { isChromeVisibleRootId } from '@/core/bookmark/chrome-system-ids'
import {
  isProposalDropAllowed,
  isProposalNodeDraggable,
  type ProposalDropPosition
} from '@/application/bookmark/proposal-tree-move'

// ✅ 设置组件名称，方便调试与日志定位
/**
 * TreeNode - 树节点渲染单元
 * - 负责单个节点的交互与展示
 */
defineOptions({ name: 'TreeNode' })

const props = withDefaults(defineProps<Props>(), {
  level: 0,
  searchQuery: '',
  highlightMatches: true,
  isVirtualMode: false,
  strictOrder: false,
  loadingMoreFolders: () => new Set()
})

// === Emits 定义 ===
/**
 * 组件对外抛出的事件列表
 * - 与父组件联动，完成节点操作
 */
const emit = defineEmits<{
  (e: 'nodeClick', node: BookmarkNode, event: MouseEvent): void
  (e: 'folderToggle', folderId: string, node: BookmarkNode): void
  (e: 'nodeSelect', nodeId: string, node: BookmarkNode): void
  (e: 'nodeEdit', node: BookmarkNode): void
  (e: 'nodeDelete', node: BookmarkNode): void
  (e: 'bookmarkOpenNewTab', node: BookmarkNode): void
  (e: 'bookmarkCopyUrl', node: BookmarkNode): void
  (e: 'bookmarkToggleFavorite', node: BookmarkNode, isFavorite: boolean): void
  (e: 'nodeMounted', id: string, el: HTMLElement): void
  (e: 'nodeUnmounted', id: string): void
  (e: 'dragStart', node: BookmarkNode): void
  (e: 'dragOver', data: { node: BookmarkNode; position: ProposalDropPosition }): void
  (e: 'dragLeave', node: BookmarkNode): void
  (
    e: 'drop',
    data: {
      sourceId: string
      targetId: string
      position: ProposalDropPosition
    }
  ): void
  (e: 'dragEnd'): void
  (e: 'folderShare', node: BookmarkNode): void
  (e: 'openContextMenu', nodeId: string, x: number, y: number): void
}>()

// ✅ i18n 已移除（收藏功能已移至右键菜单，不再需要 tooltip 文本）
// const { t } = useI18n()

const ALLOWED_FAVICON_PROTOCOLS = new Set(['http:', 'https:', 'data:', 'blob:'])

function sanitizeFaviconUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined
  try {
    const parsed = new URL(rawUrl, window.location.origin)
    if (!ALLOWED_FAVICON_PROTOCOLS.has(parsed.protocol)) {
      return undefined
    }
    return parsed.toString()
  } catch {
    return undefined
  }
}

// === Props 定义 ===
/**
 * 🌿 节点组件支持的属性集合
 * - 结合父级树控件传入的状态
 * - 所有属性均补充中文说明，便于协作
 */
interface Props {
  node: BookmarkNode
  level: number
  expandedFolders: Set<string>
  selectedNodes: Set<string>
  searchQuery?: string | undefined
  /** 是否对标题进行关键字高亮 */
  highlightMatches?: boolean | undefined
  config: {
    size?: 'compact' | 'comfortable' | 'spacious' | undefined
    searchable?: boolean | undefined
    selectable?: boolean | 'single' | 'multiple' | undefined
    editable?: boolean | undefined
    showSelectionCheckbox?: boolean | undefined
    draggable?: boolean | undefined // ✅ 是否启用拖拽
    showBookmarkUrl?: boolean | undefined // ✅ 是否显示书签 URL
    // 细粒度按钮控制
    showFavoriteButton?: boolean | undefined
    showEditButton?: boolean | undefined
    showDeleteButton?: boolean | undefined
    showOpenNewTabButton?: boolean | undefined
    showCopyUrlButton?: boolean | undefined
    showShareButton?: boolean | undefined
    showMoreButton?: boolean | undefined // ✅ 是否显示"更多操作"按钮
    /** 提案树 parentId 解析（拖拽环检测） */
    resolveParentId?: ((nodeId: string) => string | undefined) | undefined
  }
  isVirtualMode?: boolean | undefined
  /** 严格顺序渲染：不对 children 去重/重排 */
  strictOrder?: boolean | undefined
  /** 当前激活高亮的节点ID（用于 SidePanel 当前页面高亮） */
  activeId?: string | null | undefined
  /** 键盘导航焦点的节点ID */
  focusedId?: string | null | undefined
  /** 正在自动加载更多子节点的文件夹ID集合 */
  loadingMoreFolders?: Set<string> | undefined
  /** 已选后代计数 Map（folderId -> 已选书签数）*/
  selectedDescCounts?: Map<string, number> | undefined
  /** 拖拽状态（由 BookmarkTree 传入） */
  dragState?:
    | {
        isDragging: boolean
        dragSourceId: string | null
        dropTargetId: string | null
        dropPosition: ProposalDropPosition | null
      }
    | undefined
  /** 当前打开右键菜单的节点 ID */
  contextMenuNodeId?: string | null | undefined
}
// 根元素引用与生命周期上报，用于构建元素注册表以优化滚动定位
const rootRef = ref<HTMLElement | null>(null)
// ✅ 拖拽清理函数引用
let cleanupDrag: (() => void) | null = null

/**
 * 根据指针位置计算文件夹/书签行的放置落点
 */
function resolveDropPosition(clientY: number, element: HTMLElement): ProposalDropPosition {
  const rect = element.getBoundingClientRect()
  const relativeY = clientY - rect.top
  const height = rect.height
  const folder = !props.node.url

  if (folder) {
    if (isChromeVisibleRootId(String(props.node.id))) {
      return relativeY < height / 2 ? 'inside' : 'inside-last'
    }
    if (relativeY < height / 4) {
      return 'before'
    }
    if (relativeY > (height * 3) / 4) {
      return 'inside-last'
    }
    return 'inside'
  }

  return relativeY < height / 2 ? 'before' : 'after'
}

onMounted(() => {
  if (rootRef.value) {
    emit('nodeMounted', String(props.node.id), rootRef.value)
  }

  // ✅ 启用拖拽功能
  if (props.config.draggable && rootRef.value) {
    cleanupDrag = combine(
      // 1️⃣ 将节点设置为可拖拽源
      draggable({
        element: rootRef.value,
        canDrag: () => isProposalNodeDraggable(String(props.node.id)),
        getInitialData: () => ({
          type: 'bookmark-node',
          nodeId: String(props.node.id),
          node: props.node
        }),
        onGenerateDragPreview: ({ nativeSetDragImage }) => {
          // 🎨 生成自定义拖拽预览（类似 Chrome 书签管理器）
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: pointerOutsideOfPreview({
              x: '16px',
              y: '8px'
            }),
            render: ({ container }) => {
              const preview = document.createElement('div')
              preview.className = 'bookmark-drag-preview'

              // 创建图标
              const icon = document.createElement('div')
              icon.className = 'preview-icon'

              if (props.node.url) {
                // 书签：显示 favicon
                const favicon = document.createElement('img')
                favicon.className = 'preview-favicon'
                favicon.src =
                  safeFaviconUrl.value ||
                  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="%23e0e0e0"/></svg>'
                favicon.onerror = () => {
                  favicon.style.display = 'none'
                  icon.innerHTML = '📄'
                  icon.style.fontSize = '16px'
                }
                icon.appendChild(favicon)
              } else {
                // 文件夹：显示文件夹图标
                icon.innerHTML = isExpanded.value ? '📂' : '📁'
                icon.style.fontSize = '16px'
              }

              // 创建标题
              const title = document.createElement('div')
              title.className = 'preview-title'
              title.textContent = props.node.title || '未命名'

              preview.appendChild(icon)
              preview.appendChild(title)
              container.appendChild(preview)
            }
          })
        },
        onDragStart: () => {
          logger.debug('TreeNode', '开始拖拽', { nodeId: props.node.id })
          emit('dragStart', props.node)
        },
        onDrop: () => {
          logger.debug('TreeNode', '拖拽结束', { nodeId: props.node.id })
          emit('dragEnd')
        }
      }),

      // 2️⃣ 将节点设置为可放置目标
      dropTargetForElements({
        element: rootRef.value,
        canDrop: ({ source, input }) => {
          const sourceId = String(source.data.nodeId)
          const targetId = String(props.node.id)
          const sourceNode = source.data.node as BookmarkNode | undefined
          const resolveParentId = props.config.resolveParentId ?? (() => undefined)

          if (!rootRef.value) {
            return false
          }

          const position = resolveDropPosition(input.clientY, rootRef.value)

          return isProposalDropAllowed({
            sourceId,
            targetId,
            sourceIsFolder: Boolean(sourceNode && !sourceNode.url),
            position,
            resolveParentId
          })
        },
        getData: ({ input, element }) => {
          const position = resolveDropPosition(input.clientY, element as HTMLElement)

          return {
            type: 'bookmark-node-drop',
            nodeId: String(props.node.id),
            position
          }
        },
        onDragEnter: ({ self }) => {
          const position = self.data.position as ProposalDropPosition
          logger.debug('TreeNode', '拖拽进入', {
            nodeId: props.node.id,
            position
          })
          emit('dragOver', { node: props.node, position })
        },
        onDrag: ({ self }) => {
          const position = self.data.position as ProposalDropPosition
          emit('dragOver', { node: props.node, position })
        },
        onDragLeave: () => {
          logger.debug('TreeNode', '拖拽离开', { nodeId: props.node.id })
          emit('dragLeave', props.node)
        },
        onDrop: ({ source, self }) => {
          const sourceId = String(source.data.nodeId)
          const targetId = String(props.node.id)
          const position = self.data.position as ProposalDropPosition

          logger.info('TreeNode', '拖拽放置', {
            sourceId,
            targetId,
            position
          })

          emit('drop', { sourceId, targetId, position })
        }
      })
    )
  }
})

onUnmounted(() => {
  emit('nodeUnmounted', String(props.node.id))
  // ✅ 清理拖拽事件监听
  if (cleanupDrag) {
    cleanupDrag()
    cleanupDrag = null
  }
})

// === 计算属性 ===
// 🚀 性能优化:缓存基础计算属性
const isFolder = computed(() => !props.node.url)

// 🚀 性能优化：缓存展开状态检查
const isExpanded = computed(() => props.expandedFolders.has(String(props.node.id)))
const isSelected = computed(() => props.selectedNodes.has(String(props.node.id)))
const isEmptyFolder = computed(() => {
  if (!isFolder.value) return false
  if (typeof props.node.childrenCount === 'number') return props.node.childrenCount === 0
  return Array.isArray(props.node.children) && props.node.children.length === 0
})
const folderIconName = computed(() => {
  if (isEmptyFolder.value) return 'folder-minus'
  return isExpanded.value ? 'folder-open' : 'folder'
})

// 🆕 收藏状态（已移除，收藏功能已移至右键菜单）
// const isFavorited = computed(() => {
//   return Boolean(props.node.isFavorite)
// })

// 根目录（level === 0）不允许编辑/删除
const isRootFolder = computed(() => isFolder.value && props.level === 0)

// 🚀 性能优化：缓存半选中状态计算
const isIndeterminate = computed(() => {
  if (!isFolder.value) return false

  // 如果父节点本身被选中，则不显示半选中
  if (isSelected.value) return false

  // 如果有任何子孙节点被选中，则显示半选中
  const counts = props.selectedDescCounts
  if (!counts) return false
  const selected = counts.get(String(props.node.id)) || 0
  return selected > 0
})

// ✅ 使用懒加载Favicon服务（带缓存、域名复用、可视区域加载）
const {
  faviconUrl,
  // isError: faviconLoadFailed,
  handleLoad: handleFaviconLoad,
  handleError: handleFaviconErrorNew
} = useLazyFavicon({
  url: toRef(() => props.node.url),
  rootEl: rootRef,
  enabled: false // ⚠️ 临时禁用懒加载，立即加载所有favicon以快速填充缓存
})

const safeFaviconUrl = computed(() => sanitizeFaviconUrl(faviconUrl.value))

// 🚀 性能优化：缓存高亮标题计算
const highlightedTitle = computed(() => {
  if (!props.node.title) return ''
  if (!props.highlightMatches) return props.node.title
  if (!props.searchQuery) return props.node.title
  const query = props.searchQuery
  const title = props.node.title
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi')
  return title.replace(regex, '<mark>$1</mark>')
})

const truncatedUrl = computed(() => {
  if (!props.node.url) return ''
  const maxLength = 40
  return props.node.url.length > maxLength
    ? `${props.node.url.substring(0, maxLength)}...`
    : props.node.url
})

// ✅ 国际化 tooltip 文本（已移除，收藏功能已移至右键菜单）
// const tooltips = computed(() => ({
//   addToFolder: t('tree_node_add_to_folder', props.node.title),
//   editFolder: t('tree_node_edit_folder'),
//   deleteFolder: t('tree_node_delete_folder'),
//   shareFolder: t('tree_node_share_folder'),
//   favorite: t('tree_node_favorite'),
//   unfavorite: t('tree_node_unfavorite'),
//   openNewTab: t('tree_node_open_new_tab'),
//   copyUrl: t('tree_node_copy_url'),
//   editBookmark: t('tree_node_edit_bookmark'),
//   deleteBookmark: t('tree_node_delete_bookmark')
// }))

// 渲染用子节点：保持传入顺序，不做去重
const renderChildren = computed(() => {
  const children = Array.isArray(props.node.children) ? props.node.children : []
  return children
})

// ✅ 拖拽状态计算属性
const isDraggingSource = computed(() => {
  return props.dragState?.isDragging && props.dragState.dragSourceId === String(props.node.id)
})

const dropPosition = computed(() => {
  // 只有当前节点是放置目标时，才返回放置位置
  const isDropTarget = props.dragState?.dropTargetId === String(props.node.id)
  return isDropTarget ? props.dragState?.dropPosition : null
})

// === 性能优化：缓存节点样式类
const nodeClasses = computed(() => {
  // ✅ 激活状态：只有当 activeId 不为空时才进行比较
  const isActive =
    props.activeId != null &&
    props.node.id != null &&
    String(props.activeId) === String(props.node.id)

  // ✅ 焦点状态：键盘导航焦点
  const isFocused =
    props.focusedId != null &&
    props.node.id != null &&
    String(props.focusedId) === String(props.node.id)

  // ✅ 右键菜单打开状态：当前节点打开了右键菜单
  const hasContextMenuOpen =
    props.contextMenuNodeId != null &&
    props.node.id != null &&
    String(props.contextMenuNodeId) === String(props.node.id)

  // 🐛 调试日志
  if (isFocused) {
    logger.debug('TreeNode', '节点获得焦点', {
      nodeId: props.node.id,
      title: props.node.title,
      focusedId: props.focusedId,
      isActive,
      isFocused
    })
  }

  return {
    'node--folder': isFolder.value,
    'node--bookmark': !isFolder.value,
    'node--expanded': isExpanded.value,
    'node--active': isActive,
    'node--focused': isFocused,
    'node--context-menu-open': hasContextMenuOpen,
    // ✅ 拖拽功能启用标识
    'node--draggable': props.config.draggable === true,
    // ✅ 拖拽状态类
    'node--dragging': isDraggingSource.value,
    'node--drop-before': dropPosition.value === 'before',
    'node--drop-inside': dropPosition.value === 'inside' || dropPosition.value === 'inside-last',
    'node--drop-after': dropPosition.value === 'after',
    'node--drop-inside-last': dropPosition.value === 'inside-last',
    [`node--level-${props.level}`]: true,
    [`node--${props.config.size || 'comfortable'}`]: true
  }
})

/**
 * 固定行高样式：结合 size 映射到统一高度 + 缩进
 */
const itemStyle = computed(() => {
  const size = props.config.size || 'comfortable'
  const heightMap: Record<'compact' | 'comfortable' | 'spacious', number> = {
    compact: 30,
    comfortable: 36,
    spacious: 44
  }

  // ✅ 计算缩进 - 使用 margin-left 实现，避免 hover 背景色延伸到缩进区域
  const level = props.level ?? 0
  const indentSize = getIndentSize()
  const marginLeft = level * indentSize

  return {
    '--item-height': `${heightMap[size]}px`,
    marginLeft: `${marginLeft}px`
  }
})

// ✅ 移除了 v-memo 优化，不再需要缓存子节点状态检查函数

// === 事件处理 ===

const handleFolderToggleClick = (event: MouseEvent) => {
  const t = event.target as HTMLElement
  if (t.closest('.node-actions')) {
    return
  }

  // 点击选择框时只走 md-checkbox 的 change（全选/取消），勿冒泡触发展开收起
  if (t.closest('md-checkbox')) {
    return
  }

  // 如果是文件夹，总是处理展开/收起逻辑
  if (isFolder.value) {
    emit('nodeClick', props.node, event)
    emit('folderToggle', props.node.id, props.node)
    return
  }

  // 对于非文件夹节点（书签），触发点击事件
  emit('nodeClick', props.node, event)
}

const handleBookmarkClick = (event: MouseEvent) => {
  const t = event.target as HTMLElement
  if (t.closest('.node-actions')) {
    return
  }

  if (t.closest('md-checkbox')) {
    return
  }

  // ✅ 普通点击：触发 node-click 事件（由父组件决定行为）
  emit('nodeClick', props.node, event)
}

const toggleSelection = () => {
  emit('nodeSelect', String(props.node.id), props.node)
}

// ✅ 收藏功能已移至右键菜单
// const handleToggleFavorite = () => {
//   const newFavoriteState = !isFavorited.value
//   logger.info(
//     'TreeNode',
//     `${newFavoriteState ? '⭐ 收藏' : '🗑️ 取消收藏'}书签:`,
//     props.node.title
//   )
//   emit('bookmarkToggleFavorite', props.node, newFavoriteState)
// }

const handleFaviconError = () => {
  handleFaviconErrorNew()
}

// === 工具函数 ===
const handleChildNodeClick = (node: BookmarkNode, event: MouseEvent) => {
  emit('nodeClick', node, event)
}

const handleChildFolderToggle = (folderId: string, node: BookmarkNode) => {
  emit('folderToggle', folderId, node)
}

const handleChildNodeSelect = (nodeId: string, node: BookmarkNode) => {
  emit('nodeSelect', nodeId, node)
}

const handleChildNodeEdit = (node: BookmarkNode) => {
  emit('nodeEdit', node)
}

const handleChildNodeDelete = (node: BookmarkNode) => {
  emit('nodeDelete', node)
}

const handleChildBookmarkOpenNewTab = (node: BookmarkNode) => {
  emit('bookmarkOpenNewTab', node)
}

const handleChildBookmarkCopyUrl = (node: BookmarkNode) => {
  emit('bookmarkCopyUrl', node)
}

const handleChildBookmarkToggleFavorite = (node: BookmarkNode, isFavorite: boolean) => {
  emit('bookmarkToggleFavorite', node, isFavorite)
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getIndentSize(): number {
  switch (props.config.size) {
    case 'compact':
      return 20 // ✅ 增加缩进：16 → 20
    case 'spacious':
      return 32 // ✅ 增加缩进：24 → 32
    default:
      return 24 // ✅ 增加缩进：20 → 24
  }
}

/**
 * 打开右键菜单
 * @description 通过 emit 事件通知父组件打开菜单
 */
const openContextMenu = (event?: Event) => {
  // 获取节点元素的位置
  const nodeEl = rootRef.value
  if (!nodeEl) {
    logger.warn('TreeNode', '无法获取节点元素', props.node.id)
    return
  }

  const rect = nodeEl.getBoundingClientRect()

  // 如果是鼠标事件，使用鼠标位置；否则使用节点位置
  const mouseEvent = event as MouseEvent | undefined
  const x = mouseEvent ? mouseEvent.clientX : rect.right - 30
  const y = mouseEvent ? mouseEvent.clientY : rect.top + rect.height / 2

  // 通知父组件打开菜单
  emit('openContextMenu', String(props.node.id), x, y)

  logger.debug('TreeNode', '请求打开右键菜单', {
    nodeId: props.node.id,
    title: props.node.title,
    x,
    y
  })
}

// ✅ 暴露方法给父组件
defineExpose({
  openContextMenu
})
</script>

<template>
  <div ref="rootRef" class="simple-tree-node" :class="nodeClasses" :data-node-id="String(node.id)">
    <!-- 文件夹节点 -->
    <div
      v-if="isFolder"
      class="node-content folder-content no-select"
      :style="itemStyle"
      @click="handleFolderToggleClick"
      @contextmenu.prevent="openContextMenu"
    >
      <!-- 选择复选框 -->
      <md-checkbox
        v-if="config.showSelectionCheckbox && config.selectable === 'multiple' && !isRootFolder"
        :checked="isSelected"
        :indeterminate="isIndeterminate"
        class="select-checkbox"
        @change="toggleSelection"
      ></md-checkbox>

      <!-- 文件夹图标 -->
      <div class="folder-icon">
        <LucideIcon
          :name="folderIconName"
          :size="18"
          :class="['folder-icon-svg', { 'folder-icon-svg--empty': isEmptyFolder }]"
        />
      </div>

      <!-- 文件夹标题 -->
      <div class="node-title" :title="node.title">
        <span v-html="highlightedTitle"></span>
      </div>

      <!-- "⋮" 更多操作按钮 -->
      <Button
        v-if="props.config.showMoreButton !== false"
        variant="icon"
        class="more-actions-button"
        title="更多操作"
        @click.stop="openContextMenu"
      >
        <LucideIcon name="more-vertical" :size="16" />
      </Button>
    </div>

    <!-- 书签节点 -->
    <div
      v-else
      class="node-content bookmark-content no-select"
      :class="{ 'node-content--selected': isSelected }"
      :style="itemStyle"
      @click="handleBookmarkClick"
      @contextmenu.prevent="openContextMenu"
    >
      <!-- 书签选择复选框 -->
      <md-checkbox
        v-if="config.showSelectionCheckbox && config.selectable === 'multiple'"
        :checked="isSelected"
        :indeterminate="false"
        class="select-checkbox"
        @change="toggleSelection"
      ></md-checkbox>
      <!-- 书签图标/Favicon（带懒加载） -->
      <div class="bookmark-icon">
        <!-- 加载成功时显示favicon图片 -->
        <img
          v-if="safeFaviconUrl"
          :src="safeFaviconUrl"
          :alt="node.title"
          :style="{ width: '16px', height: '16px' }"
          loading="lazy"
          decoding="async"
          @load="handleFaviconLoad"
          @error="handleFaviconError"
        />
        <!-- 加载失败或无URL时显示备用图标 -->
        <LucideIcon v-else name="link" :size="16" color="secondary" />
      </div>

      <!-- 书签标题 -->
      <div class="node-title">
        <span v-html="highlightedTitle"></span>
      </div>

      <!-- AI标签 -->
      <md-chip-set v-if="Array.isArray(node.tags) && node.tags.length > 0" class="bookmark-tags">
        <md-input-chip v-for="tag in node.tags" :key="tag" :label="tag"></md-input-chip>
      </md-chip-set>

      <!-- 书签URL (hover时显示) -->
      <div
        v-if="config.showBookmarkUrl !== false && config.size === 'spacious' && node.url"
        class="bookmark-url"
      >
        {{ truncatedUrl }}
      </div>

      <!-- "⋮" 更多操作按钮 -->
      <Button
        v-if="props.config.showMoreButton !== false"
        variant="icon"
        class="more-actions-button"
        title="更多操作"
        @click.stop="openContextMenu"
      >
        <LucideIcon name="more-vertical" :size="16" />
      </Button>
    </div>

    <!-- 子节点：仅文件夹节点在展开时显示子节点 -->
    <div v-if="isFolder && isExpanded && node.children && !isVirtualMode" class="children">
      <TreeNode
        v-for="child in renderChildren"
        :key="child.id"
        :node="child"
        :level="level + 1"
        :expanded-folders="expandedFolders"
        :selected-nodes="selectedNodes"
        :search-query="searchQuery"
        :config="config"
        :active-id="activeId"
        :focused-id="focusedId"
        :loading-more-folders="loadingMoreFolders"
        :drag-state="dragState"
        :context-menu-node-id="contextMenuNodeId"
        @node-click="handleChildNodeClick"
        @folder-toggle="handleChildFolderToggle"
        @node-select="handleChildNodeSelect"
        @node-edit="handleChildNodeEdit"
        @node-delete="handleChildNodeDelete"
        @bookmark-open-new-tab="handleChildBookmarkOpenNewTab"
        @bookmark-copy-url="handleChildBookmarkCopyUrl"
        @bookmark-toggle-favorite="handleChildBookmarkToggleFavorite"
        @node-mounted="(id: string, el: HTMLElement) => $emit('nodeMounted', id, el)"
        @node-unmounted="(id: string) => $emit('nodeUnmounted', id)"
        @open-context-menu="
          (id: string, x: number, y: number) => $emit('openContextMenu', id, x, y)
        "
        @drag-start="$emit('dragStart', $event)"
        @drag-over="$emit('dragOver', $event)"
        @drag-leave="$emit('dragLeave', $event)"
        @drop="$emit('drop', $event)"
        @drag-end="$emit('dragEnd')"
      />
    </div>
  </div>
</template>

<style scoped>
@keyframes slide-down {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.simple-tree-node {
  position: relative;
  user-select: none;
}

.node-content {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: var(--item-height, 32px);
  padding: 0 var(--spacing-sm);
  cursor: default;
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast);
}

/* 文件夹悬停效果 - 淡黄色渐变 + 左侧橙色边框 */
.folder-content {
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  min-height: 36px; /* 文件夹行高稍大 */
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  border-left: 3px solid transparent;
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  border-radius: 18px; /* 36px / 2 = 胶囊形状 */
  transition:
    background var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard),
    border-left-color var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard),
    box-shadow var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

/* 书签行高紧凑 */
.bookmark-content {
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  min-height: 30px;
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  border-left: 3px solid transparent; /* 与文件夹对齐 */
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  border-radius: 15px; /* 30px / 2 = 胶囊形状 */
  transition:
    background var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard),
    box-shadow var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.folder-content:hover {
  background: linear-gradient(90deg, var(--color-folder-hover) 0%, transparent 100%);
}

/* 书签悬停效果 - 蓝色系 */
.bookmark-content:hover {
  background: var(--color-bookmark-hover);
}

/* ✅ 右键菜单打开时保持 hover 状态（只影响当前节点，不影响子节点） */
.node--context-menu-open > .folder-content {
  background: linear-gradient(90deg, var(--color-folder-hover) 0%, transparent 100%);
}

.node--context-menu-open > .bookmark-content {
  background: var(--color-bookmark-hover);
}

/* 选中状态高亮（持久显示）- 通过增加特异性而非 !important */

/* 书签选中 - 蓝色背景（无边框） */
.simple-tree-node .bookmark-content.node-content--selected {
  background: var(--color-bookmark-selected);
}

/* 书签选中 + hover */
.simple-tree-node .bookmark-content.node-content--selected:hover {
  background: color-mix(in srgb, var(--color-bookmark-selected), var(--color-surface) 5%);
}

/* 文件夹选中 - 黄色背景（无边框） */
.simple-tree-node .folder-content.node-content--selected {
  background: var(--color-folder-selected);
}

/* 文件夹选中 + hover */
.simple-tree-node .folder-content.node-content--selected:hover {
  background: color-mix(in srgb, var(--color-folder-selected), var(--color-surface) 5%);
}

/* 点击反馈（未选中时）- 区分文件夹和书签 */

/* 书签点击 - 蓝色系 */
.simple-tree-node .bookmark-content:not(.node-content--selected):active {
  background: var(--color-bookmark-active);
}

/* 文件夹点击 - 黄色系 */
.simple-tree-node .folder-content:not(.node-content--selected):active {
  background: var(--color-folder-active);
}

/* 文件夹样式 */
.folder-icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  margin-right: var(--spacing-0-5);
}

/* 文件夹图标颜色 - 橙黄色 */
.folder-icon-svg {
  color: var(--color-folder);
}

.folder-icon-svg--empty {
  opacity: 0.72;
}

/* 书签样式 */
.bookmark-icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 16px;
  height: 16px;
  margin-right: var(--spacing-0-5);
}

/* 选择复选框样式调整 */
.select-checkbox {
  margin-right: var(--spacing-0-5);
}

/* 文件夹行内的 Checkbox hover 使用黄色系 */
.folder-content:hover .select-checkbox {
  --md-checkbox-unselected-hover-state-layer-color: var(--color-folder-hover);
  --md-checkbox-unselected-hover-state-layer-opacity: 0.08;
}

/* 书签行内的 Checkbox hover 使用蓝色系 */
.bookmark-content:hover .select-checkbox {
  --md-checkbox-unselected-hover-state-layer-color: var(--color-bookmark-hover);
  --md-checkbox-unselected-hover-state-layer-opacity: 0.08;
}

.bookmark-icon img {
  width: 100%;
  height: 100%;
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  border-radius: 2px;
  object-fit: cover;

  /* ✅ 优化：添加微妙阴影，增强 favicon 层次感 */
  box-shadow:
    0 1px 2px var(--color-shadow-008),
    0 0 0 0.5px var(--color-shadow-005);
}

/* 标题 - 基础样式 */
.node-title {
  flex: 1;
  min-width: 0;
  font-size: var(--text-base);
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 文件夹标题 - 粗体 */
.folder-content .node-title {
  font-weight: 600;
  color: var(--color-text-primary);
}

/* 书签标题 - 常规字体 */
.bookmark-content .node-title {
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-secondary);
}

.node-title :deep(mark) {
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  padding: 0 2px;
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  border-radius: 2px;
  font-weight: 500;
  color: var(--color-warning-emphasis);
  background: var(--color-warning-subtle);
}

/* 文件夹计数始终显示 */
.folder-count {
  flex-shrink: 0;
  margin-right: var(--spacing-1);
}

/* "⋮" 更多操作按钮 */
.more-actions-button {
  flex-shrink: 0;
  margin-left: auto;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    visibility var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

/* hover 时显示"⋮"按钮 */
.node-content:hover .more-actions-button {
  opacity: 1;
  visibility: visible;
}

/* 子节点 */
.children {
  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform, opacity;

  /* ✅ 优化：使用 emphasized 缓动函数，更流畅的展开动画 */
  animation: slide-down var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
}

/* 尺寸变体 */
.node--compact .node-content {
  padding: 0 var(--spacing-1);
}

.node--compact .node-title {
  font-size: var(--text-sm);
}

.node--spacious .node-content {
  gap: var(--spacing-1-5);
  padding: 0 var(--spacing-2);
}

.node--spacious .node-title {
  font-size: var(--text-base);
}

/* 层级样式 */
.node--level-0 > .node-content {
  padding-top: var(--spacing-0-5);
  padding-bottom: var(--spacing-0-5);
  font-size: var(--text-base);
  font-weight: 600;
}

.node--level-0 > .node-content .folder-icon {
  opacity: 1;
}

/* 增强各层级的视觉区分 */
.node--level-1 > .node-content {
  font-weight: 500;
}

.node--level-2 > .node-content,
.node--level-3 > .node-content,
.node--level-4 > .node-content,
.node--level-5 > .node-content {
  font-weight: 400;
}

/* 🔆 键盘导航焦点状态（Focused）- 使用 outline 边框 */

/* 用途：键盘导航（方向键）时的焦点高亮，类似 Chrome 书签管理器 */
.simple-tree-node.node--focused > .node-content {
  /* 使用 outline 而不是 box-shadow，这样不会影响背景色 */
  outline: 2px solid var(--color-outline);
  outline-offset: -2px;
}

/* 🔆 焦点 + 选中状态（两种状态叠加）- 边框 + 选中背景色 */

/* 书签：焦点边框 + 蓝色选中背景 */
.simple-tree-node.node--focused > .bookmark-content.node-content--selected {
  outline: 2px solid var(--color-outline);
  outline-offset: -2px;
  background: var(--color-bookmark-selected);
}

/* 文件夹：焦点边框 + 黄色选中背景 */
.simple-tree-node.node--focused > .folder-content.node-content--selected {
  outline: 2px solid var(--color-outline);
  outline-offset: -2px;
  background: var(--color-folder-selected);
}

/* 🔆 激活状态（Active）- 蓝色边框 + 淡蓝色背景 */

/* 用途：表示当前打开/聚焦的书签（SidePanel 场景） */
.simple-tree-node.node--active > .node-content {
  background: var(--color-primary-subtle);
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

/* 🔆 激活 + 选中状态（两种状态叠加）- 蓝色边框 + 选中背景 */

/* 书签：激活边框 + 蓝色选中背景 */
.simple-tree-node.node--active > .bookmark-content.node-content--selected {
  background: var(--color-bookmark-selected);
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

/* 文件夹：激活边框 + 黄色选中背景 */
.simple-tree-node.node--active > .folder-content.node-content--selected {
  background: var(--color-folder-selected);
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

/* 未启用拖拽时，使用默认指针样式 */
.simple-tree-node:not(.node--draggable) .node-content {
  cursor: pointer;
}

/* 启用拖拽时的光标样式 */
.simple-tree-node.node--draggable .node-content {
  cursor: grab;
}

/* ✅ 拖拽状态样式（参考 Chrome 书签管理器） */

/* 拖拽源：半透明 */
.simple-tree-node.node--dragging {
  opacity: 0.4;
}

/* 拖拽时节点内容的光标 - 需要在 .node--dragging 之后 */
/* stylelint-disable-next-line no-descending-specificity -- 拖拽状态需要覆盖默认光标 */
.simple-tree-node.node--draggable .node-content:active {
  cursor: grabbing;
}

/* stylelint-disable-next-line no-descending-specificity -- 拖拽状态需要覆盖默认光标 */
.simple-tree-node.node--dragging .node-content {
  cursor: grabbing;
}

/* 放置位置指示线（参考 Chrome 的蓝色线条） */
.simple-tree-node.node--drop-before::before,
.simple-tree-node.node--drop-after::after {
  position: absolute;
  right: 0;
  left: var(--indent-width, 0);
  z-index: 10;
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  height: 2px;
  background: var(--color-primary);
  pointer-events: none;
  content: '';
  box-shadow: 0 0 4px color-mix(in srgb, var(--color-primary) 50%, transparent);
}

.simple-tree-node.node--drop-before::before {
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  top: -1px;
}

.simple-tree-node.node--drop-after::after {
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  bottom: -1px;
}

/* 放置到文件夹内部：轻微高亮背景 + 左侧指示线 */
/* stylelint-disable-next-line no-descending-specificity -- 拖拽放置状态需要覆盖默认样式 */
.simple-tree-node.node--drop-inside .node-content {
  position: relative;
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
}

/* 文件夹内部放置时，左侧显示垂直指示线 */
.simple-tree-node.node--drop-inside .node-content::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  width: 3px;
  /* stylelint-disable-next-line declaration-property-value-disallowed-list */
  border-radius: 0 2px 2px 0;
  background: var(--color-primary);
  content: '';
}

/* 🔆 激活 + 焦点状态（两种状态叠加）- 激活边框优先 */
/* stylelint-disable-next-line no-descending-specificity -- 需要覆盖前面的样式 */
.simple-tree-node.node--active.node--focused > .node-content {
  /* 移除 outline，使用 box-shadow */
  outline: none;
  background: var(--color-primary-subtle);
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

/* 🔆 激活 + 焦点 + 选中（三种状态叠加）- 激活边框 + 选中背景 */

/* 书签：激活边框 + 蓝色选中背景 */
/* stylelint-disable-next-line no-descending-specificity, selector-max-specificity -- 需要覆盖前面的样式 */
.simple-tree-node.node--active.node--focused > .bookmark-content.node-content--selected {
  outline: none;
  background: var(--color-bookmark-selected);
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

/* 文件夹：激活边框 + 黄色选中背景 */
/* stylelint-disable-next-line no-descending-specificity, selector-max-specificity -- 需要覆盖前面的样式 */
.simple-tree-node.node--active.node--focused > .folder-content.node-content--selected {
  outline: none;
  background: var(--color-folder-selected);
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

/* ✅ 收藏按钮样式（独立于 node-actions） */
.favorite-button-always-visible,
.favorite-button-hover-visible {
  min-width: 24px;
  height: 24px;
  margin-right: var(--spacing-1);
  padding: 0;
  border-radius: var(--border-radius-xs);
}

/* 已收藏：始终显示 */
.favorite-button-always-visible {
  opacity: 1;
  visibility: visible;
}

/* 未收藏：默认隐藏，hover 时显示 */
.favorite-button-hover-visible {
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard),
    visibility var(--md-sys-motion-duration-short4) var(--md-sys-motion-easing-standard);
}

/* hover 效果（按特异性从低到高排序） */
.favorite-button-always-visible:hover,
.favorite-button-hover-visible:hover {
  background: var(--color-surface-variant);
}

.node-content:hover .favorite-button-hover-visible {
  opacity: 1;
  visibility: visible;
}

/* ✅ 收藏图标动画（仅使用允许的属性：color/opacity） */
.favorite-icon {
  transition:
    color 0.2s ease,
    opacity 0.2s ease;
}

/* 收藏时的高亮效果（使用不透明度） */
.favorite-button-always-visible:active .favorite-icon,
.favorite-button-hover-visible:active .favorite-icon {
  opacity: 0.7;
}

/* ✅ 书签 URL 样式 - hover 时显示 */
.bookmark-url {
  flex-shrink: 0;
  max-width: 300px;
  margin-left: var(--spacing-2);
  padding: var(--spacing-0-5) var(--spacing-1-5);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  white-space: nowrap;
  color: var(--color-text-tertiary);
  background: var(--color-surface-variant);
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard),
    visibility var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* hover 时显示 URL */
.bookmark-content:hover .bookmark-url {
  opacity: 1;
  visibility: visible;
}

/* Material Web Chip 样式配置 */
md-chip-set.bookmark-tags {
  display: inline-flex;
  gap: var(--spacing-1);
  margin-top: var(--spacing-1);
}

md-input-chip {
  --md-input-chip-container-height: 20px;
  --md-input-chip-label-text-size: var(--text-xs);
  --md-input-chip-label-text-color: var(--md-sys-color-on-surface-variant);
  --md-input-chip-outline-color: var(--md-sys-color-outline);
}

/* stylelint-disable declaration-property-value-disallowed-list, color-no-hex -- 树节点组件使用特定尺寸和颜色 */
</style>

<style>
/* ✅ 暗色模式支持（使用 CSS 变量） */
@media (prefers-color-scheme: dark) {
  .bookmark-drag-preview {
    background: var(--color-surface);
    box-shadow:
      0 4px 12px var(--color-shadow-030),
      0 0 0 1px var(--color-surface-edge-010);
  }

  .bookmark-drag-preview .preview-title {
    color: var(--color-text-primary);
  }
}

.bookmark-drag-preview {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  min-width: 120px;
  max-width: 280px;
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-sm);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--color-surface);

  /* ✅ 仅用于hover时的subtle scale效果，不包含rotate */
  transition: transform 0.2s ease;
  box-shadow:
    0 4px 12px var(--color-shadow-015),
    0 0 0 1px var(--color-shadow-010);
  backdrop-filter: blur(10px);
}

.bookmark-drag-preview .preview-icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: var(--spacing-5);
  height: var(--spacing-5);
}

.bookmark-drag-preview .preview-favicon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  border-radius: 2px;
}

.bookmark-drag-preview .preview-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  white-space: nowrap;

  /* 使用设计 token，随亮/暗主题切换 */
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

/**
 * ✅ 拖拽预览标签样式 - 设计规范
 *
 * 📐 设计理念：
 * - 模仿 Chrome 原生书签管理器的拖拽视觉效果
 * - 保持平直（无倾斜），确保文字清晰可读
 * - 使用毛玻璃效果（backdrop-filter）增强层次感
 *
 * 🎨 核心特征：
 * - ❌ 不使用 transform: rotate() - 倾斜会降低可读性
 * - ✅ 使用 box-shadow 营造浮起感
 * - ✅ 自适应深色模式
 * - ✅ 响应式宽度（120px-280px）
 *
 * 💡 为何不倾斜？
 * 倾斜效果虽然增加动感，但在书签管理场景中：
 * 1. 降低标题文字可读性（尤其是长标题）
 * 2. 与系统原生拖拽视觉不一致
 * 3. 增加用户认知负担
 *
 * @see https://www.figma.com/design-systems - Material Design Drag & Drop
 */
</style>
