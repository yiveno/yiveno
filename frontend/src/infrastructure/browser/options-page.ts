/**
 * 打开或聚焦扩展设置页（与快捷键 / open_settings 同路径）。
 */
import { focusOrOpenSettingsTab } from '@/infrastructure/browser/extension-tab'

export async function openExtensionOptionsPage(): Promise<void> {
  const ok = await focusOrOpenSettingsTab()
  if (!ok) {
    throw new Error('OPEN_SETTINGS_FAILED')
  }
}
