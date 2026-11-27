/**
 * 扩展页 UI 引导：全局样式 + 滚动条「滚动中显示」绑定。
 * 各 pages 下 main.ts 统一从此入口引入（勿只引 CSS 漏绑 JS）。
 */

import '@/styles/extension-ui.css'
import { installNlgGateMetricsChromeStorage } from '@/infrastructure/storage/nlg-gate-metrics-storage'
import { bindScrollingScrollbarIndicator } from '@/infrastructure/ui/bind-scrolling-scrollbar'

bindScrollingScrollbarIndicator()
// 画像叙事 / 聚类等在扩展页跑 LLM 门禁；预热本地度量落盘
void installNlgGateMetricsChromeStorage().catch(() => {
  // 静默
})
