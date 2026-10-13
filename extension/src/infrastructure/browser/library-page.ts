/**
 * 打开扩展记忆库页（轻浏览）。
 * 与快捷键同一路径：已有 library 标签则聚焦，否则新建。
 */
import { focusOrOpenLibraryTab } from '@/infrastructure/browser/extension-tab'

export async function openExtensionLibraryPage(): Promise<void> {
  const ok = await focusOrOpenLibraryTab()
  if (!ok) {
    throw new Error('OPEN_LIBRARY_FAILED')
  }
}
