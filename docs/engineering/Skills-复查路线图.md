# Skills 复查路线图（frontend 优先）

> **目的：** 用 `chrome-extensions` + `modern-web-guidance` 分阶段复查 frontend，慢速不漏项。  
> **纪律：** 每批先只读 Issue 表 → 再小 scope 实现 P0；冲突时 Yiveno 产品文档 / `AGENTS.md` > skill 通用方案。  
> **Issue 台账（逐条状态）：** [`Skills-复查-Issues.md`](./Skills-复查-Issues.md) — 审计表与 **已修 / 延后 / 不采纳** 以该文件为准。

## 扫描范围（frontend）

| Skill                 | 路径                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `chrome-extensions`   | `public/manifest.json`、`src/background/**`、`src/content/**`、`src/infrastructure/browser/**`、扩展页 `src/pages/**`、`CHROMEWEBSTORE.md` |
| `modern-web-guidance` | `src/pages/**`、`src/infrastructure/ui/**`、`src/content/**`（UI 部分）                                                                    |
| 一般不扫              | `src/core/**`（无 Chrome/DOM）、`backend/**`                                                                                               |

官网 `website/**` 属 `modern-web-guidance` 可选批次，不在本表 frontend 阶段。

## 进度

图例：⬜ 未审计 · 🔍 只读完成 · 🔧 P0 已修 · ✅ 本模块结案

### A — chrome-extensions

| #   | 模块                      | 状态 | 备注                                                                                         |
| --- | ------------------------- | ---- | -------------------------------------------------------------------------------------------- |
| A1  | Manifest ↔ CHROMEWEBSTORE | 🔧   | 权威 permissions 表 + chromewebstore-manifest 契约单测                                       |
| A2  | Side Panel 打开           | 🔧   | 冷启动提前 setPanelBehavior、onInstalled 重试、error 日志、manifest 单测；bootstrap 幂等保留 |
| A3  | Action / Commands         | 🔧   | 冷启动提前 onCommand；manifest↔白名单契约单测；处理器全覆盖单测                              |
| A4  | SW 生命周期               | 🔧   | 冷启动提前挂 omnibox/contextMenu/alarm 监听；消息分发 await bootstrap（PING 除外）           |
| A5  | 消息传递                  | 🔧   | scope 分流正确；handler 单测；sendBackgroundMessage 传输失败结构化                           |
| A6  | Content scripts           | 🔧   | keepalive 冷启动提前注册；划词走 background-client；manifest 契约单测                        |
| A7  | Context menus             | 🔧   | onClicked await bootstrap；manifest 权限/id 契约；不可保存页单测                             |
| A8  | Omnibox                   | 🔧   | currentTab 走 navigateTabToUrl；manifest keyword 契约；bootstrap 单测                        |
| A9  | Bookmarks API             | 🔧   | onCreated/Changed/Removed/Moved await bootstrap；manifest bookmarks 契约单测                 |
| A10 | Storage / alarms          | 🔧   | onAlarm await bootstrap；ensureMemoryCloudSyncAlarm 单测；manifest 契约                      |
| A11 | externally_connectable    | 🔧   | 权威 origin 表 + manifest 契约；onMessageExternal 幂等；IDB 路径 await bootstrap             |
| A12 | Icons / CSP               | 🔧   | 权威 icon 表 + PNG 尺寸门禁；MV3 默认 CSP；扩展页 module script 契约                         |
| A13 | Options UI                | 🔧   | options_ui 契约；Vite 入口门禁；openExtensionOptionsPage 单测                                |
| A14 | CWS 合规全文              | ✅   | 母本截图/promo + graphics 契约单测；localhost 生产包剥离（A14-7）                            |

### B — modern-web-guidance

| #   | 表面              | 状态 | 备注                                                                        |
| --- | ----------------- | ---- | --------------------------------------------------------------------------- |
| B1  | Library           | 🔧   | 虚拟列表 + 行级 `content-visibility` 叠加；detail export 缓存               |
| B2  | Side Panel Recall | 🔧   | recall-body scroll rAF；conversation content-visibility；scroll 单测        |
| B3  | Recall 结果卡     | 🔧   | `toRecallMatchCard` 抽测；IO 可见 TTE；v-memo + content-visibility          |
| B4  | Capture / 划词    | 🔧   | Shadow 走 design token；guards/scroll/a11y 已接线                           |
| B5  | Settings          | 🔧   | composable + 子组件拆分；popstate 深链；visibility 合并单测                 |
| B6  | Getting Started   | 🔧   | progress/actions 纯函数单测；visibility 回前台刷新；step content-visibility |
| B7  | App\* 共享 UI     | 🔧   | AppSwitch thumb 用 `translateX`；section-tabs 键盘 / modal trap             |
| B8  | i18n / a11y 横切  | 🔧   | `bootExtensionPage` 五页；backlog 批次 1 见 Issues 台账                     |

## 推荐批次顺序

1. **A2** Side Panel 加固 ✅
2. **B1** Library 性能 P0+P1 ✅
3. **A5** 消息传递 ✅
4. **A6** Content scripts ✅
5. **A3** Action / Commands ✅
6. **A4** SW 生命周期 ✅
7. **A7** Context menus ✅
8. **A8** Omnibox ✅
9. **A9** Bookmarks API ✅
10. **A10** Storage / alarms ✅
11. **A11** externally_connectable ✅
12. **A12** Icons / CSP ✅
13. **A13** Options UI ✅
14. **A14** CWS 合规全文 ✅
15. **B2** Side Panel Recall ✅
16. B3 → …

## 单会话 Brief 模板

```markdown
## Skills 复查 · 会话 N — [模块 id]

**Skill:** chrome-extensions / modern-web-guidance（后者须 search→retrieve）

**In:** （1–3 个路径，写死）

**Out:** 只读 Issue 表 / 或仅 P0 实现

**验收:** Issue≥3 条或 P0+单测+MCP 一句结论；**完整表落盘** [`Skills-复查-Issues.md`](./Skills-复查-Issues.md)
```

## 已归档审计结论

> **逐条 Issue 与修复状态** 见 [`Skills-复查-Issues.md`](./Skills-复查-Issues.md)（含跨模块 P1/P2 待办索引）。以下为各模块一行摘要。

- **B 组 Side Panel MV3**（2026-08-30）：架构正确；P1 冷启动、P2 可观测、P3 manifest 门禁、P5 文档笔误
- **C 组 Library**（2026-08-30）：摘录无虚拟列表；双层滚动；优先虚拟化+rAF，content-visibility 作叠加
- **A5 消息传递**（2026-08-30）：单向数据流合规；`scope=background|ui|content` 分流；registry↔handler 有 doc:check；P0：`sendBackgroundMessage` 捕获 runtime 失败；P1：content 直发 sendMessage 未走 client → **A6 已改**；GET_BOOKMARK_LIBRARY_TREE payload 内联解析；offscreen PING 未 return true（同步可工作）
- **A6 Content scripts**（2026-08-30）：划词 IIFE + manifest 对齐；keepalive bfcache 处理完善；P0：keepalive 须在 bootstrap 前注册（同 A2 冷启动）；P1：划词 CAPTURE/OPEN_RECALL 改 `background-client`；快捷键走页内 API 非 tabs.sendMessage（设计如此）
- **A3 Action/Commands**（2026-08-30）：`_execute_action`→Side Panel（A2）；自定义命令 registry 白名单；P0：onCommand 冷启动提前注册；manifest 契约；P1：`open_library`/`open_settings` 失败闪 error badge（2026-08-31）；P2：extension-tab `tabs.query({ url })` 替代全量扫（2026-08-31）
- **A4 SW 生命周期**（2026-08-30）：`ensureBackgroundBootstrapped` 幂等合并并发；P0：业务消息分发前 await bootstrap（PING 探活除外）；omnibox/contextMenu/alarm 监听提前至 SW 入口；P1：无 `runtime.onStartup`（每次 SW wake 已 bootstrap）；P2：bootstrap 失败仅打日志、靠下次消息重试
- **A7 Context menus**（2026-08-30）：单选区项 upsert + 稳定 id；菜单项仅 onInstalled 注册（避免 reload 重复 API）；P0：onClicked 先 bootstrap（补 A4 旁路）；manifest `contextMenus` 权限；P1：菜单文案仅 install/update 刷新
- **A8 Omnibox**（2026-08-30）：离线轨 `entry: omnibox` + requestId 防竞态（单测充分）；P0：`currentTab` 改 `navigateTabToUrl(lastFocusedWindow)`；监听 A4 已提前注册；`ensureReady` 动态 import 破 bootstrap 环；无追问会话
- **A9 Bookmarks API**（2026-08-30）：灌库开关控制挂/卸四事件监听；pending 队列等 bulk import；P0：书签事件写 IDB 前 await bootstrap（动态 import）；manifest `bookmarks` 契约单测；GET_BOOKMARK_LIBRARY_TREE 经 message-handler 已 bootstrap；P1：SW 入口 `syncChromeBookmarkSyncListenersWithIngestSetting` 异步读设置前短暂无监听窗口
- **A10 Storage / alarms**（2026-08-30）：local/session 经 Zod 封装；sync 关则 `alarms.clear`；P0：`onAlarm` 增量同步前 await bootstrap；`ensureMemoryCloudSyncAlarm` 单测；manifest `storage`+`alarms` 契约；CHROMEWEBSTORE 已披露；P1：external handoff 归并 IDB 异步不阻塞官网；P2：`chrome.storage` 用量 bootstrap 采样 ≥80% warn（2026-08-31）
- **A11 externally_connectable**（2026-08-30）：仅官网 OAuth handoff（session/sign-out Zod）；`core/extension/externally-connectable-origins` 权威表 ↔ manifest matches 契约；P0：`onMessageExternal` origin 拒绝 + 幂等注册；session 写 storage 立即 ok，IDB 归并/embedding 前 await bootstrap；CHROMEWEBSTORE 已披露；P1：listener 无 remove（仅 SW 生命周期一次）
- **A12 Icons / CSP**（2026-08-30）：16/32/48/128 PNG 存在且尺寸正确；`icons`↔`action.default_icon` 权威表；无自定义放宽 CSP / 无 sandbox；扩展页仅 `type=module` 外链脚本；content_scripts 无远程/内联 CSS；P1：HTML favicon 链 icon16/32（`extension-page-favicon-contract.test.ts`）
- **A13 Options UI**（2026-08-30）：`options_ui`→`settings.html`+`open_in_tab`；分区 `?section=` 深链 + `settings-sections` 单测；设置走 `background-client`；程序内打开用 `focusOrOpenSettingsTab`（非 `openOptionsPage`）；`open_settings` 无默认快捷键；P1：无 `popstate` 回退同步（仅 replaceState）
- **A14 CWS 合规全文**（2026-08-30）：`extension-cws-contract` 权威 permissions/host；`chromewebstore-manifest-contract` + `chromewebstore-graphics-contract` 单测；短描述↔`app_description`；icon128 已验；母本截图/promo 落盘 `brand-assets/chrome-web-store/`（2026-09-01）；产品 UI 截图 3–5 待补；`build:fe:prod` 经 `clean-dist` 剔除 `localhost:8787` host_permissions
- **B2 Side Panel Recall**（2026-08-30）：单层 flex 滚动；`background-client` 合规；空态/黏底/composer a11y OK；P0：`recall-shell-scroll` rAF 黏底检测+滚底；`content-visibility` on turns；P1：长线程未虚拟化（会话通常短）；P2：Show more 仍全量 DOM
- **B3 Recall 结果卡**（2026-08-30）：摘录/书签双形态+favicon fallback+duplicate sibling+detail export 合规；hover 无几何变换；P0：`resolveRecallCardClickAction`/`buildRecallEvidencePayload`/`scheduleRecallEvidenceWhenVisible` 单测；TTE evidence 改 IO 可见后再发；`v-memo` on 列表卡；`content-visibility` on card group；P1：长 Show more 列表仍全量 DOM；P2：`toMatchCard` 仍在 SidePanel 未抽测
- **B4 Capture / 划词**（2026-08-30）：Shadow DOM 浮层+快照选区+background-client 合规；keepalive/bfcache 完善；P0：`selection-toolbar-guards` 接入 scroll（附注模式滚动不收起）；`selection-toolbar-scroll` rAF 合并；`SELECTION_TOOLBAR_SHOW_DELAY_MS` 单常量；`role=toolbar`+aria-label；P1：滚动不重锚仅收起；P2：Shadow 样式走 `brand.css`/`semantic-colors` token（`selection-toolbar-shadow-styles.ts`）
- **B5 Settings**（2026-08-30）：单层 panel 滚动+`background-client`；分区 tabs a11y OK；P0：`popstate` 恢复 `?section=`；`settings-page-url-sync`/`settings-visibility-refresh` 单测；合并 visibility 监听；`content-visibility` on block；P1：tab 切换 `pushState` 历史栈（2026-08-31）；P2：Settings.vue 单体过大未拆
- **B6 Getting Started**（2026-08-30）：划词 bundle 打入页+`captureEntry=getting_started`；步骤 ol a11y OK；P0：`deriveGettingStartedProgress`/`shouldRefreshGettingStartedProgress`/`canSave*`/`canTry*` 单测；`visibilitychange` 回前台刷新进度；`content-visibility` on step；P1：成功态依赖 storage 非即时 recallDone；P2：无独立 manifest 契约（icons-csp 已覆盖 HTML）
- **B7 App\* 共享 UI**（2026-08-30）：AppButton/Switch/Modal/Tabs/Toast 合规；hover 无几何变换（Menu chevron 仅 open 态 rotate、Dock 浮层入场例外）；P0：`resolveAppSectionTabIndex` 单测；`isElementFocusableVisible` 强化 trap；`APP_HOVER_MENU_*` 常量；P1：AppSwitch thumb 仍用 left 过渡；P2：无 Storybook
- **B8 i18n / a11y 横切**（2026-08-30）：`t()` 无 `||` 兜底；产品面无 Search；图标控件 title/aria 经 `t()`；P0：`bootExtensionPage` 五扩展页统一 `applyDocumentLocale`+关键 key 启动 warn；`extension-i18n-boot`/`icon-only-control-a11y` 单测；P1：`i18n:check` 全量 en 扫 Search 禁用词（2026-08-31）；P2：content script 浮层 boot 门禁（2026-08-31）
