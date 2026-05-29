/**
 * Material Web 组件预加载（扩展各 HTML 入口在 `app.mount` 之前必须 await）
 *
 * 背景：`vite/build-options.ts` 虽已对 `@material/web` 保留 `moduleSideEffects`，
 * 仍建议在入口用**动态 import** 显式拉取本应用用到的全部 MWC，避免：
 * - 子入口未覆盖某组件时 SFC 内纯副作用 `import` 被摇掉；
 * - 挂载时标签尚未 `customElements.define`，无 Shadow DOM / 无样式。
 *
 * @see Dialog.vue 内历史说明与 `frontend/src/pages/popup/main.ts` 注释
 */

import { logger } from '@/infrastructure/logging/logger'

/** 用于启动日志抽样检查（非全量枚举） */
const SAMPLE_CUSTOM_ELEMENT_TAGS = [
  'md-tabs',
  'md-primary-tab',
  'md-dialog',
  'md-slider',
  'md-linear-progress',
  'md-filled-tonal-button',
  'md-filled-icon-button',
  'md-chip-set',
  'md-input-chip'
] as const

/**
 * 预加载扩展内用到的全部 Material Web 模块（执行 `customElements.define`）
 *
 * @param context 日志前缀（如 `Popup`、`Management`）
 */
export async function preloadMaterialWebComponents(context: string): Promise<void> {
  logger.info(context, 'MaterialWeb', '开始预加载 Material Web Components…')

  await Promise.all([
    import('@material/web/ripple/ripple.js'),
    import('@material/web/focus/md-focus-ring.js'),
    import('@material/web/elevation/elevation.js')
  ])

  await Promise.all([
    import('@material/web/button/filled-button.js'),
    import('@material/web/button/outlined-button.js'),
    import('@material/web/button/text-button.js'),
    import('@material/web/button/filled-tonal-button.js'),
    import('@material/web/checkbox/checkbox.js'),
    import('@material/web/chips/chip-set.js'),
    import('@material/web/chips/input-chip.js'),
    import('@material/web/dialog/dialog.js'),
    import('@material/web/divider/divider.js'),
    import('@material/web/icon/icon.js'),
    import('@material/web/iconbutton/icon-button.js'),
    import('@material/web/iconbutton/filled-icon-button.js'),
    import('@material/web/list/list.js'),
    import('@material/web/list/list-item.js'),
    import('@material/web/menu/menu.js'),
    import('@material/web/menu/menu-item.js'),
    import('@material/web/progress/circular-progress.js'),
    import('@material/web/progress/linear-progress.js'),
    import('@material/web/select/filled-select.js'),
    import('@material/web/select/outlined-select.js'),
    import('@material/web/select/select-option.js'),
    import('@material/web/slider/slider.js'),
    import('@material/web/switch/switch.js'),
    import('@material/web/tabs/tabs.js'),
    import('@material/web/tabs/primary-tab.js'),
    import('@material/web/textfield/outlined-text-field.js'),
    import('@material/web/textfield/filled-text-field.js')
  ])
  if (typeof customElements === 'undefined') {
    logger.warn(context, 'MaterialWeb', '当前环境无 customElements，跳过注册检查')
    return
  }

  const sample: Record<string, boolean> = {}
  for (const tag of SAMPLE_CUSTOM_ELEMENT_TAGS) {
    sample[tag] = !!customElements.get(tag)
  }
  logger.info(context, 'MaterialWeb', '预加载完成（抽样）', sample)
}
