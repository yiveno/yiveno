/**
 * 书签领域通用类型。
 */
import type { BookmarkRecord } from '@/infrastructure/indexeddb/schema'

/**
 * Chrome API 原始书签结构（保持最小字段）。
 */
export interface ChromeBookmarkTreeNode {
  /** 节点 ID（Chrome 分配） */
  id: string
  /** 父节点 ID */
  parentId?: string | undefined
  /** 同父节点下的顺序索引 */
  index?: number | undefined
  /** 节点标题 */
  title: string
  /** 书签 URL，文件夹为空 */
  url?: string | undefined
  /** 创建时间 */
  dateAdded?: number | undefined
  /** 文件夹内容变更时间 */
  dateGroupModified?: number | undefined
  /** 最后修改时间 */
  dateModified?: number | undefined
  /** 子节点（仅文件夹存在） */
  children?: ChromeBookmarkTreeNode[] | undefined
  /** 受保护标记，如书签栏、其他书签等 */
  unmodifiable?: string | undefined
}

/**
 * 统一的书签树节点。
 *
 * 提供 UI 层常用的附加字段，并保持与 Chrome 数据兼容。
 */
export interface BookmarkNode extends Omit<ChromeBookmarkTreeNode, 'children' | 'unmodifiable'> {
  /** 子节点列表 */
  children?: BookmarkNode[] | undefined
  /** 子节点数量（已加载） */
  childrenCount?: number | undefined
  /** 逐层路径（节点名数组） */
  path?: string[] | undefined
  /** 路径字符串形式（`/` 分隔） */
  pathString?: string | undefined
  /** 路径 ID 列表 */
  pathIds?: Array<string | number> | undefined
  /** 自定义标签 */
  tags?: string[] | undefined
  /** 节点层级，从 0 开始 */
  level?: number | undefined
  /** 提取的域名信息 */
  domain?: string | undefined
  /** Favicon 地址 */
  favicon?: string | undefined
  /** 访问次数 */
  visits?: number | undefined
  /** 最后访问时间戳 */
  lastVisit?: number | undefined
  /** 评分或检索相关度 */
  score?: number | undefined
  /** 是否是文件夹（兼容旧逻辑） */
  isFolder?: boolean | undefined
  /** UI 展开状态 */
  expanded?: boolean | undefined
  /** UI 选中状态 */
  selected?: boolean | undefined
  /** 是否被修改过 */
  modified?: boolean | undefined
  /** 子节点是否已加载完成 */
  _childrenLoaded?: boolean | undefined
  /** 特征标签，例如 invalid（失效书签）/ duplicate（重复书签）/ internal（内部书签）等 */
  traitTags?: string[] | undefined
  /** 特征标签元数据（检测时间、来源等） */
  traitMetadata?:
    | Array<{
        tag: 'duplicate' | 'invalid' | 'internal'
        detectedAt: number
        source: 'worker' | 'user' | 'imported'
        notes?: string | undefined
      }>
    | undefined
  /** 是否收藏 */
  isFavorite?: boolean | undefined
  /** 收藏排序 */
  favoriteOrder?: number | undefined
  /** 收藏时间戳 */
  favoritedAt?: number | undefined
  [key: string]: unknown
}

/** IndexedDB 中缓存的书签记录。 */
export type { BookmarkRecord }

/** 父节点到其子节点数组的索引。 */
export type BookmarkChildrenIndex = Map<string, BookmarkNode[]>
/** 根据节点 ID 建立的映射。 */
export type BookmarkNodeMap = Map<string, BookmarkNode>

/** 提案树节点（右侧编辑面板/AI 提案）。 */
export interface ProposalNode {
  /** 节点 ID */
  id: string
  /** 节点标题 */
  title: string
  /** 书签 URL */
  url?: string | undefined
  /** 子节点列表 */
  children?: ProposalNode[] | undefined
  /** 父节点 ID */
  parentId?: string | undefined
  /** 排序索引 */
  index?: number | undefined
  /** 创建时间 */
  dateAdded?: number | undefined
}

/** 书签编辑弹窗所需的数据。 */
export interface BookmarkEditData {
  /** 节点 ID */
  id: string
  /** 标题 */
  title: string
  /** URL */
  url: string
  /** 父节点 ID */
  parentId?: string | undefined
}

/** 新增书签/文件夹时的表单数据。 */
export interface AddItemData {
  /** 节点类型 */
  type: 'folder' | 'bookmark'
  /** 标题 */
  title: string
  /** URL，文件夹置空 */
  url?: string
  /** 父节点 ID */
  parentId?: string
}

/** 类型守卫：检查对象是否为 BookmarkNode。 */
export function isBookmarkNode(obj: unknown): obj is BookmarkNode {
  if (!obj || typeof obj !== 'object') return false
  const candidate = obj as BookmarkNode
  return typeof candidate.id === 'string' && typeof candidate.title === 'string'
}

/** 类型守卫：检查数组是否为 BookmarkNode[]。 */
export function isBookmarkArray(arr: unknown): arr is BookmarkNode[] {
  return Array.isArray(arr) && arr.every(isBookmarkNode)
}

/** 类型守卫：检查对象是否为 ChromeBookmarkTreeNode。 */
export function isChromeBookmarkTreeNode(obj: unknown): obj is ChromeBookmarkTreeNode {
  if (!obj || typeof obj !== 'object') return false
  const candidate = obj as ChromeBookmarkTreeNode
  return typeof candidate.id === 'string' && typeof candidate.title === 'string'
}
