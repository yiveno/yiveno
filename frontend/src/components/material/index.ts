/**
 * Material Web Components 统一 re-export（供类型或按需拉取符号等场景）
 *
 * **运行时注册**：各 HTML 入口须在 `app.mount` 前 `await preloadMaterialWebComponents(...)`，
 * 见 `frontend/src/infrastructure/material/preload-material-web.ts`。Vue SFC 内请勿再写纯副作用
 * `import '@material/web/...'`，避免与入口策略分叉。
 *
 * 使用方式（非典型）：
 * - 需要具名类型/类时：`import { MdFilledButton } from '@/components/material'` 等
 */

// ============================================
// Buttons
// ============================================
export * from '@material/web/button/filled-button.js'
export * from '@material/web/button/outlined-button.js'
export * from '@material/web/button/text-button.js'
export * from '@material/web/button/elevated-button.js'
export * from '@material/web/button/tonal-button.js'

// ============================================
// Icon Buttons
// ============================================
export * from '@material/web/iconbutton/icon-button.js'
export * from '@material/web/iconbutton/filled-icon-button.js'
export * from '@material/web/iconbutton/outlined-icon-button.js'

// ============================================
// FAB (Floating Action Button)
// ============================================
export * from '@material/web/fab/fab.js'
export * from '@material/web/fab/branded-fab.js'

// ============================================
// Text Fields
// ============================================
export * from '@material/web/textfield/filled-text-field.js'
export * from '@material/web/textfield/outlined-text-field.js'

// ============================================
// Selection Controls
// ============================================
export * from '@material/web/checkbox/checkbox.js'
export * from '@material/web/radio/radio.js'
export * from '@material/web/switch/switch.js'

// ============================================
// Dialogs
// ============================================
export * from '@material/web/dialog/dialog.js'

// ============================================
// Lists
// ============================================
export * from '@material/web/list/list.js'
export * from '@material/web/list/list-item.js'

// ============================================
// Menus
// ============================================
export * from '@material/web/menu/menu.js'
export * from '@material/web/menu/menu-item.js'
export * from '@material/web/menu/sub-menu.js'

// ============================================
// Chips
// ============================================
export * from '@material/web/chips/chip-set.js'
export * from '@material/web/chips/filter-chip.js'
export * from '@material/web/chips/input-chip.js'
export * from '@material/web/chips/assist-chip.js'
export * from '@material/web/chips/suggestion-chip.js'

// ============================================
// Progress Indicators
// ============================================
export * from '@material/web/progress/linear-progress.js'
export * from '@material/web/progress/circular-progress.js'

// ============================================
// Tabs
// ============================================
export * from '@material/web/tabs/tabs.js'
export * from '@material/web/tabs/primary-tab.js'
export * from '@material/web/tabs/secondary-tab.js'

// ============================================
// Sliders
// ============================================
export * from '@material/web/slider/slider.js'

// ============================================
// Select
// ============================================
export * from '@material/web/select/filled-select.js'
export * from '@material/web/select/outlined-select.js'
export * from '@material/web/select/select-option.js'

// ============================================
// Icons
// ============================================
export * from '@material/web/icon/icon.js'

// ============================================
// Dividers
// ============================================
export * from '@material/web/divider/divider.js'

// ============================================
// Elevation
// ============================================
export * from '@material/web/elevation/elevation.js'

// ============================================
// Ripple
// ============================================
export * from '@material/web/ripple/ripple.js'

// ============================================
// Focus Ring
// ============================================
export * from '@material/web/focus/focus-ring.js'

// ============================================
// Vue 封装组件
// ============================================
// ⚠️ 注意：不要在这里导出 Vue 组件！
// Vue 组件会导致 Rolldown 将 Vue 代码打包到 app-components chunk
// 如果 background.js 间接依赖了这个文件，会导致 Service Worker 环境中出现 HTMLElement 错误
//
// 如果需要使用 MaterialButton，请直接导入：
// import MaterialButton from '@/components/material/MaterialButton.vue'
//
// export { default as MaterialButton } from './MaterialButton.vue'  // ❌ 已禁用
