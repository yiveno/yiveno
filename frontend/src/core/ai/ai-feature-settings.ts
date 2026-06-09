/**
 * AI 功能开关（chrome.storage.local）键名与默认值
 */

/** 自动添加书签开关存储键 */
export const AI_AUTO_BOOKMARK_STORAGE_KEY = 'aiAutoBookmark'

/** 一键整理开关存储键 */
export const AI_ONE_CLICK_ORGANIZE_STORAGE_KEY = 'aiOneClickOrganize'

/** Pro 语义检索开关存储键 */
export const SEMANTIC_SEARCH_STORAGE_KEY = 'semanticSearchEnabled'

/** 功能开关默认值：未显式关闭时视为开启 */
export const AI_FEATURE_DEFAULT_ENABLED = true

/**
 * 解析自动添加书签开关
 *
 * @param stored chrome.storage.local 中的原始值
 */
export function isAiAutoBookmarkEnabled(stored: unknown): boolean {
  if (stored === false) return false
  return AI_FEATURE_DEFAULT_ENABLED
}

/**
 * 解析一键整理开关
 *
 * @param stored chrome.storage.local 中的原始值
 */
export function isAiOneClickOrganizeEnabled(stored: unknown): boolean {
  if (stored === false) return false
  return AI_FEATURE_DEFAULT_ENABLED
}

/**
 * 解析 Pro 语义检索开关（默认开启）
 *
 * @param stored chrome.storage.local 中的原始值
 */
export function isSemanticSearchEnabled(stored: unknown): boolean {
  if (stored === false) return false
  return AI_FEATURE_DEFAULT_ENABLED
}
