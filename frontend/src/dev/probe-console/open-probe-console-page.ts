/**
 * 打开 DEV 测试工作台（probe-console.html）。
 * 仅 development；生产构建无该页、不得从产品路径静态依赖本模块逻辑以外的桥。
 */
import { focusOrOpenExtensionHtmlPage } from '@/infrastructure/browser/extension-tab'

const PROBE_CONSOLE_PATH = 'probe-console.html'
const PROBE_CONSOLE_TAB_SESSION_KEY = 'yiveno.probeConsoleTabId'

/** 聚焦已有工作台标签，否则新建。 */
export async function openProbeConsolePage(): Promise<void> {
  if (!import.meta.env.DEV) {
    throw new Error('PROBE_CONSOLE_DEV_ONLY')
  }
  const ok = await focusOrOpenExtensionHtmlPage(PROBE_CONSOLE_PATH, PROBE_CONSOLE_TAB_SESSION_KEY)
  if (!ok) {
    throw new Error('OPEN_PROBE_CONSOLE_FAILED')
  }
}
