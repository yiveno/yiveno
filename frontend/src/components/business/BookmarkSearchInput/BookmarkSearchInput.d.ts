import type { BookmarkNode } from '@/types'
import type { Ref } from 'vue'

/**
 * 交互展示模式
 */
export type DisplayMode =
  | 'icon' // 圆形图标，点击展开（适合 popup 等空间受限场景）
  | 'compact' // 紧凑搜索框，始终显示（适合 side-panel）
  | 'full' // 完整搜索框 + 所有功能（适合 management 页面）
  | 'inline' // 内联模式，无边框（适合嵌入其他组件）

/**
 * 搜索结果展示方式
 */
export type ResultDisplay =
  | 'dropdown' // 下拉列表（默认）- 显示前 N 条结果
  | 'navigate' // 导航模式 - 搜索后跳转到其他页面
  | 'emit' // 仅触发事件 - 由父组件处理结果

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

/**
 * BookmarkSearchInput 组件 Props
 */
export interface BookmarkSearchInputProps {
  // ========== 交互模式 ==========
  /**
   * 交互展示模式
   * @default 'icon'
   */
  displayMode?: DisplayMode

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
  resultDisplay?: ResultDisplay

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

/**
 * BookmarkSearchInput 组件 Emits
 */
export interface BookmarkSearchInputEmits {
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
}

/**
 * BookmarkSearchInput 组件暴露的方法
 */
export interface BookmarkSearchInputExpose {
  /**
   * 手动触发搜索
   * @param query - 搜索关键词
   */
  search: (query: string) => Promise<void>

  /**
   * 获取当前搜索结果
   */
  getResults: () => BookmarkNode[]

  /**
   * 清空搜索
   */
  clear: () => void

  /**
   * 是否正在搜索
   */
  isSearching: Ref<boolean>

  /**
   * 总结果数
   */
  totalResults: Ref<number>
}
