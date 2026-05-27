/**
 * 🧩 组件库统一导出
 *
 * 使用示例：
 * import { Button, Input, BookmarkTree } from '@/components'
 */

// ===== 基础 UI 组件 (从 base/ 目录导出) =====
// 原子级组件：单一功能的最小 UI 单元
export { default as Accordion } from './base/Accordion/Accordion.vue'
export { default as AccordionItem } from './base/Accordion/AccordionItem.vue'
export { default as AnimatedNumber } from './base/AnimatedNumber/AnimatedNumber.vue'
export { default as AsyncSearchSelect } from './base/AsyncSearchSelect/AsyncSearchSelect.vue'
export { default as Chip } from './base/Chip/Chip.vue'
export { default as ContextMenu } from './base/ContextMenu/ContextMenu.vue'
export { default as Input } from './base/Input/Input.vue'
export { default as Loading } from './base/Loading/Loading.vue'
export { default as LucideIcon } from './base/LucideIcon/LucideIcon.vue'
export { default as Skeleton } from './base/Skeleton/Skeleton.vue'
export { default as SkeletonList } from './base/Skeleton/SkeletonList.vue'
export { default as SkeletonTree } from './base/Skeleton/SkeletonTree.vue'
export { default as Tooltip } from './base/Tooltip/Tooltip.vue'

// ===== 复合组件 (从 composite/ 目录导出) =====
// 通用复合组件：多个基础组件组合，但无业务逻辑
export { default as AppHeader } from './composite/AppHeader/AppHeader.vue'
export { default as Avatar } from './composite/Avatar/Avatar.vue'
export { default as Card } from './composite/Card/Card.vue'
export { default as Dialog } from './composite/Dialog/Dialog.vue'
export { default as EmptyState } from './composite/EmptyState/EmptyState.vue'

/**
 * ✨ Ant Design 风格的 Notification 组件（推荐使用）
 *
 * 使用方式：
 * ```typescript
 * import { useNotification } from '@/composables/useNotification'
 * const notification = useNotification()
 * notification.success({ message: '成功', key: 'my-key' })
 * ```
 *
 * 或使用全局服务（兼容旧代码）：
 * ```typescript
 * notificationService.notify('成功', { level: 'success', key: 'my-key' })
 * ```
 */
export { default as Notification } from './composite/Notification/Notification.vue'

export { default as ThemeToggle } from './composite/ThemeToggle/ThemeToggle.vue'

// ===== 业务组件 (从 business/ 目录导出) =====
// 包含业务逻辑的项目专属组件
export { default as BookmarkTree } from './business/BookmarkTree/BookmarkTree.vue'
// TreeNode 是 BookmarkTree 的内部组件，不对外导出
export { default as BookmarkRecommendations } from './business/BookmarkRecommendations/BookmarkRecommendations.vue'
export { default as BookmarkSearchInput } from './business/BookmarkSearchInput/BookmarkSearchInput.vue'
export { default as NotificationList } from './business/NotificationList/NotificationList.vue'
export { default as ShareDialog } from './business/ShareDialog/ShareDialog.vue'

// ===== 类型导出 =====
// 基础组件类型
export type * from './base/Accordion/Accordion.d'
export type * from './base/AnimatedNumber/AnimatedNumber.d'
export type * from './base/AsyncSearchSelect/AsyncSearchSelect.d'
export type * from './base/Chip/Chip.d'
export type * from './base/ContextMenu/ContextMenu.d'
export type * from './base/Input/Input.d'
export type * from './base/Loading/Loading.d'
export type * from './base/Skeleton/Skeleton.d'
export type * from './base/Skeleton/SkeletonList.d'
export type * from './base/Skeleton/SkeletonTree.d'
export type * from './base/Tooltip/Tooltip.d'

// 复合组件类型
export type * from './composite/AppHeader/AppHeader.d'
export type * from './composite/Avatar/Avatar.d'
export type * from './composite/Card/Card.d'
export type * from './composite/Dialog/Dialog.d'
export type * from './composite/EmptyState/EmptyState.d'
export type * from './composite/ThemeToggle/ThemeToggle.d'

// 业务组件类型
export type * from './business/BookmarkTree/BookmarkTree.d'
// TreeNode 类型不对外导出（内部组件）
export type * from './business/BookmarkRecommendations/BookmarkRecommendations.d'
export type * from './business/BookmarkSearchInput/BookmarkSearchInput.d'
export type * from './business/ShareDialog/ShareDialog.d'

// ===== 性能优化工具 =====
export * from '@/composables/useSimplePerformance'
