/**
 * 扩展页 UI 引导：全局样式 + 滚动条「滚动中显示」绑定。
 * 各 pages 下 main.ts 统一从此入口引入（勿只引 CSS 漏绑 JS）。
 */

import '@/styles/extension-ui.css'
import { bindScrollingScrollbarIndicator } from '@/infrastructure/ui/bind-scrolling-scrollbar'

bindScrollingScrollbarIndicator()
