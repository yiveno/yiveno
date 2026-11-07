/**
 * 打开扩展 HTML 页的薄封装（设置 / 记忆库 / Getting Started）。
 * 由原 options-page / library-page / getting-started-page 机械合并。
 */

import {
  focusOrOpenGettingStartedTab,
  focusOrOpenLibraryTab,
  focusOrOpenSettingsTab
} from '@/infrastructure/browser/extension-tab'

/**
 * 打开或聚焦扩展设置页（与快捷键 / open_settings 同路径）。
 */
export async function openExtensionOptionsPage(): Promise<void> {
  const ok = await focusOrOpenSettingsTab()
  if (!ok) {
    throw new Error('OPEN_SETTINGS_FAILED')
  }
}

/**
 * 打开扩展记忆库页（轻浏览）。
 * 与快捷键同一路径：已有 library 标签则聚焦，否则新建。
 */
export async function openExtensionLibraryPage(): Promise<void> {
  const ok = await focusOrOpenLibraryTab()
  if (!ok) {
    throw new Error('OPEN_LIBRARY_FAILED')
  }
}

/**
 * 打开或聚焦 Getting Started 页（与安装引导同路径）。
 */
export async function openGettingStartedPage(): Promise<void> {
  await focusOrOpenGettingStartedTab()
}
