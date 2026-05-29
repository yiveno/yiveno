// 汇总导出 Pinia store，请仅暴露 presentation 层允许访问的 store
export { useBookmarkManagementStore } from "./bookmark/bookmark-management-store";
export { useBookmarkStore } from "./bookmarkStore";
export { usePopupStoreIndexedDB } from "./popup-store-indexeddb";
export { useQueryStore } from "./query-store/query-store";
export { useDialogStore } from "./ui/dialog-store";
export { useUIStore } from "./ui-store";
export { useTraitFilterStore } from "./trait-filter/trait-filter-store";
export { useTraitDataStore } from "./trait-data-store";

// === 类型导出 ===
export type {
  BookmarkNode,
  ChromeBookmarkTreeNode,
  ProposalNode,
} from "@/types";

export type { BookmarkStats, TraitOverview } from "./popup-store-indexeddb";

export type { SnackbarState, LoadingState } from "./ui-store";

export type { TraitStatistics } from "./trait-data-store";
