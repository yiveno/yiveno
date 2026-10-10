/**
 * 判定路径变更是否会使 content script IIFE 产物过期。
 *
 * 契约（勿随意收窄）：
 * - content/ 自身变更 → 必重打
 * - core/ · infrastructure/ 可能被划词脚本 import → 必重打
 * - content IIFE / 本收尾插件自身 → 必重打
 * - 仅 pages/ · background/ · application/ 等 → watch 下可跳过 content 重打
 */

/** 规范化后路径是否会使 content IIFE 失效。 */
export function pathInvalidatesContentScript(id: string): boolean {
  const normalized = id.replace(/\\/g, '/')
  return (
    normalized.includes('/src/content/') ||
    normalized.includes('/content/selection-toolbar/') ||
    normalized.includes('/src/core/') ||
    normalized.includes('/src/infrastructure/') ||
    normalized.includes('/vite/content-scripts-iife') ||
    normalized.includes('/vite/extension-post-build')
  )
}

/** 是否为划词 content 源路径（可走 content-only 防抖重打）。 */
export function isContentScriptPath(id: string): boolean {
  const normalized = id.replace(/\\/g, '/')
  return normalized.includes('/src/content/') || normalized.includes('/content/selection-toolbar/')
}
