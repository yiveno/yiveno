/**
 * 📦 Composables 导出文件
 */

// ============================================
// 认证相关
// ============================================
export { useSupabaseAuth } from "./useSupabaseAuth";
export { useSubscription } from "./useSubscription";

// ============================================
// 键盘快捷键（按页面分类）
// ============================================
export { usePopupKeyboard } from "./usePopupKeyboard";
export { useManagementKeyboard } from "./useManagementKeyboard";
export { useSettingsKeyboard } from "./useSettingsKeyboard";
export { useSidePanelKeyboard } from "./useSidePanelKeyboard";
export { useTreeKeyboard } from "./useTreeKeyboard";
export { useCommandsShortcuts } from "./useCommandsShortcuts";

// ============================================
// 键盘快捷键基础工具
// ============================================
export { useKeyboard } from "./useKeyboard";
export { useKeyboardModifier } from "./useKeyboardModifier";
export { useKeyboardHelp } from "./useKeyboardHelp";

// ============================================
// 书签相关
// ============================================
export { useLazyFavicon } from "./useLazyFavicon";
export type {
  UseLazyFaviconOptions,
  UseLazyFaviconReturn,
} from "./useLazyFavicon";

// ============================================
// 特征数据
// ============================================
export {
  useTraitStatistics,
  useTraitCount,
  useTotalNegativeTraits,
  useHasNegativeTraits,
  useTraitLoading,
  useTraitLastUpdated,
  useRefreshTraits,
} from "./useTraitData";

// ============================================
// 爬虫和通知
// ============================================
export { useNotification } from "./useNotification";

// ============================================
// 性能和同步
// ============================================
export {
  useDebounce,
  useThrottle,
  useVirtualScroll,
  useLazyLoad,
  usePerformanceMonitor,
  useMemoryManagement,
  useReactiveOptimization,
} from "./useSimplePerformance";
export { useCrossPageSync } from "./useCrossPageSync";
export { useGlobalSyncProgress } from "./useGlobalSyncProgress";
export { useThemeSync, applyColorPresetToDocument } from "./useThemeSync";
