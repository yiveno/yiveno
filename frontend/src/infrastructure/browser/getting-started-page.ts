/**
 * 打开或聚焦 Getting Started 页（与安装引导同路径）。
 */
import { focusOrOpenGettingStartedTab } from '@/infrastructure/browser/extension-tab'

export async function openGettingStartedPage(): Promise<void> {
  await focusOrOpenGettingStartedTab()
}
