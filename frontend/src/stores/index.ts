// 汇总导出 Pinia store，请仅暴露 presentation 层允许访问的 store
export { useBookmarkManagementStore } from './bookmark-management-store'
export { useBookmarkStore } from './bookmark-tree-store'
export { usePopupStoreIndexedDB } from './popup-store-indexeddb'
export { useDialogStore } from './dialog-store'
export { useUIStore } from './ui-store'
export { useTraitFilterStore } from './trait-filter-store'
export { useTraitDataStore } from './trait-data-store'

// === 类型导出 ===
export type { BookmarkNode, ChromeBookmarkTreeNode, ProposalNode } from '@/types'

export type { BookmarkStats } from './popup-store-indexeddb'

export type { SnackbarState, LoadingState } from './ui-store'

export type { TraitStatistics } from './trait-data-store'
