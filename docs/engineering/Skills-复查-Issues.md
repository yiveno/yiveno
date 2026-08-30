# Skills 复查 · Issue 台账

> **权威 Issue 表。** 每模块审计须先在此落表，再实现 P0。  
> **路线图进度：** [`Skills-复查路线图.md`](./Skills-复查路线图.md)  
> **维护：** 每完成一轮「只读 → P0」后，更新对应模块表格的 **状态** 列；新模块先加表再改代码。

## 图例

| 状态            | 含义                                 |
| --------------- | ------------------------------------ |
| **已修**        | 本轮或后续批次已实现（含单测 / MCP） |
| **已合规**      | 审计确认无 gap，无需改动             |
| **延后**        | P1/P2 或明确暂不修，保留追踪         |
| **不采纳**      | 产品 / 架构冲突或 ROI 低，刻意不修   |
| **已修·{模块}** | 在其它模块批次中解决（注明 id）      |

**严重度：** P0 = 本轮必选 · P1 = 可延后 · P2 = 观察 / 低优 · — = 合规项

## 总览（待办）

| 严重度 | 未关闭 |
| ------ | -----: |
| P1     |     18 |
| P2     |     14 |

> 统计口径：下表状态为 **延后** 或 **不采纳** 的条目（2026-08-31）。

---

## A — chrome-extensions

### A1 · Manifest ↔ CHROMEWEBSTORE

**模块状态：** 🔧 · 审计 2026-08-30（与 A14 闭环）

| #   | 项                                                         | 严重 | 状态   | 处置 / 备注                                                              |
| --- | ---------------------------------------------------------- | ---- | ------ | ------------------------------------------------------------------------ |
| 1   | manifest `permissions` 与 `CHROMEWEBSTORE.md` 理由表易漂移 | P0   | 已修   | `extension-cws-contract.ts` + `chromewebstore-manifest-contract.test.ts` |
| 2   | `host_permissions` 未与文档双向门禁                        | P0   | 已修   | 同上（A14）                                                              |
| 3   | 商店短描述与 `_locales/en` `app_description` 未锁定        | P0   | 已修   | 契约单测                                                                 |
| 4   | `CHROMEWEBSTORE.md` 初稿已存在                             | —    | 已合规 | 随 A14 补全披露                                                          |

---

### A2 · Side Panel 打开

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                                         | 严重 | 状态   | 处置 / 备注                            |
| --- | ---------------------------------------------------------- | ---- | ------ | -------------------------------------- |
| 1   | `setPanelBehavior` 仅在 bootstrap 内，冷启动点图标可能无效 | P0   | 已修   | `main.ts` SW 入口提前注册              |
| 2   | `onInstalled` 未二次确保 Side Panel 行为                   | P0   | 已修   | `main.ts` 幂等重试                     |
| 3   | `setPanelBehavior` 失败仅 warn，难排查                     | P0   | 已修   | `side-panel.ts` → `logger.error`       |
| 4   | manifest `sidePanel` / 无 popup 无回归门禁                 | P0   | 已修   | `manifest-side-panel-contract.test.ts` |
| 5   | 架构文档 API 笔误                                          | P2   | 已修   | `Yiveno-运行时架构流程-v1.md`          |
| 6   | bootstrap 内保留兜底调用                                   | —    | 已合规 | 与入口重复注册，幂等                   |

---

### A3 · Action / Commands

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                                              | 严重 | 状态   | 处置 / 备注                                 |
| --- | --------------------------------------------------------------- | ---- | ------ | ------------------------------------------- |
| 1   | `_execute_action` 无 popup → Side Panel                         | —    | 已合规 | A2 已覆盖；契约单测加固                     |
| 2   | 自定义命令经 registry 白名单                                    | —    | 已合规 | 保持                                        |
| 3   | `registerCommandListeners` 仅在 bootstrap，冷启动首按快捷键丢失 | P0   | 已修   | `main.ts` 入口提前注册                      |
| 4   | manifest `commands` 与 `EXTENSION_COMMAND_IDS` 无对齐门禁       | P0   | 已修   | `manifest-action-commands-contract.test.ts` |
| 5   | `suggested_key` 数量 / i18n `__MSG_`                            | —    | 已合规 | 单测锁定 ≤4                                 |
| 6   | `open_library` / `open_settings` 失败无 action badge            | P1   | 延后   | 仅划词 `no_receiver` 闪错                   |
| 7   | `extension-tab` 全量 `tabs.query({})` 扫库页                    | P2   | 延后   | 后续优化                                    |

---

### A4 · SW 生命周期

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                                              | 严重 | 状态   | 处置 / 备注                                   |
| --- | --------------------------------------------------------------- | ---- | ------ | --------------------------------------------- |
| 1   | `handleBackgroundMessage` 不 await bootstrap，冷启动 IDB 未就绪 | P0   | 已修   | 非 `PING` 先 `ensureBackgroundBootstrapped()` |
| 2   | omnibox / contextMenu / alarm 监听仅在 bootstrap                | P0   | 已修   | 提前至 `main.ts` 入口                         |
| 3   | `ensureBackgroundBootstrapped` 幂等、并发合并                   | —    | 已合规 | 保持                                          |
| 4   | A2/A3/A6 冷启动监听模式统一                                     | —    | 已合规 | 已形成模式                                    |
| 5   | 无 `runtime.onStartup`                                          | P1   | 不采纳 | 每次 SW wake 已 bootstrap，可接受             |
| 6   | bootstrap 首次失败仅打日志                                      | P2   | 延后   | 靠下次消息重试                                |

---

### A5 · 消息传递

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                                     | 严重 | 状态    | 处置 / 备注               |
| --- | ------------------------------------------------------ | ---- | ------- | ------------------------- |
| 1   | 单向数据流：UI → `background-client` → SW              | —    | 已合规  | 保持                      |
| 2   | `scope` 分流 background / ui / content                 | —    | 已合规  | 补 `message-handler` 单测 |
| 3   | registry ↔ handler `doc:check`                         | —    | 已合规  | 保持                      |
| 4   | `sendBackgroundMessage` 无 try/catch，传输失败直接抛错 | P0   | 已修    | `MESSAGE_DISPATCH_FAILED` |
| 5   | content script 直调 `sendMessage` 未走 client          | P1   | 已修·A6 | A6 改 `background-client` |
| 6   | `GET_BOOKMARK_LIBRARY_TREE` payload 内联解析未走 Zod   | P1   | 延后    | handler 内联              |
| 7   | offscreen `PING` listener 未 `return true`             | P2   | 延后    | 同步场景可工作            |

---

### A6 · Content scripts

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                                 | 严重 | 状态   | 处置 / 备注                                |
| --- | -------------------------------------------------- | ---- | ------ | ------------------------------------------ |
| 1   | keepalive 仅在 bootstrap 注册，冷启动 connect 风暴 | P0   | 已修   | `main.ts` 入口提前注册                     |
| 2   | 划词 `CAPTURE` / `OPEN_RECALL` 直调 `sendMessage`  | P1   | 已修   | 改 `background-client`                     |
| 3   | keepalive bfcache / 重连逻辑                       | —    | 已合规 | 保持                                       |
| 4   | 快捷键走页内 API 非 `tabs.sendMessage`             | —    | 不采纳 | 设计如此                                   |
| 5   | content scope Zod + 单测                           | —    | 已合规 | 保持                                       |
| 6   | manifest ↔ 构建产物无回归门禁                      | P2   | 已修   | `manifest-content-script-contract.test.ts` |

---

### A7 · Context menus

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                             | 严重 | 状态   | 处置 / 备注                      |
| --- | ---------------------------------------------- | ---- | ------ | -------------------------------- |
| 1   | 单菜单项 upsert + 稳定 id                      | —    | 已合规 | 保持                             |
| 2   | `contexts: ['selection']` + `isSavablePageUrl` | —    | 已合规 | 补单测                           |
| 3   | 菜单仅 `onInstalled` 注册                      | —    | 已合规 | 避免 reload 重复 API             |
| 4   | `onClicked` 监听 A4 已提前                     | —    | 已合规 | 保持                             |
| 5   | `onClicked` 未 await bootstrap 即写 IDB        | P0   | 已修   | `ensureBackgroundBootstrapped()` |
| 6   | 失败路径 logger + badge                        | —    | 已合规 | 保持                             |
| 7   | 菜单文案仅 install/update 刷新 i18n            | P1   | 不采纳 | SW reload 不刷新可接受           |

---

### A8 · Omnibox

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                       | 严重 | 状态   | 处置 / 备注        |
| --- | ---------------------------------------- | ---- | ------ | ------------------ |
| 1   | `requestId` 防竞态                       | —    | 已合规 | 单测已覆盖         |
| 2   | `ensureReady` 动态 import 破环           | —    | 已合规 | 保持               |
| 3   | 监听 A4 已提前                           | —    | 已合规 | 保持               |
| 4   | `currentTab` 用无 tabId 的 `tabs.update` | P0   | 已修   | `navigateTabToUrl` |
| 5   | 离线轨 `entry: omnibox`                  | —    | 已合规 | 无追问会话         |
| 6   | 书签建议经 `omnibox-open.html`           | —    | 已合规 | 保持               |

---

### A9 · Bookmarks API

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                                  | 严重 | 状态   | 处置 / 备注                           |
| --- | --------------------------------------------------- | ---- | ------ | ------------------------------------- |
| 1   | 书签四事件写 IDB 前未 await bootstrap               | P0   | 已修   | `chrome-bookmark-sync.ts`             |
| 2   | 灌库开关控制挂/卸监听                               | —    | 已合规 | 保持                                  |
| 3   | pending 队列等 bulk import                          | —    | 已合规 | 保持                                  |
| 4   | manifest `bookmarks` 无契约单测                     | P0   | 已修   | `manifest-bookmarks-contract.test.ts` |
| 5   | `GET_BOOKMARK_LIBRARY_TREE` 经 handler 已 bootstrap | —    | 已合规 | 保持                                  |
| 6   | SW 入口读设置前短暂无监听窗口                       | P1   | 延后   | 异步读 ingest 设置                    |

---

### A10 · Storage / alarms

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                          | 严重 | 状态   | 处置 / 备注                  |
| --- | ------------------------------------------- | ---- | ------ | ---------------------------- |
| 1   | `onAlarm` 增量同步未 await bootstrap        | P0   | 已修   | `memory-cloud-sync-alarm.ts` |
| 2   | `storage`/`alarms` manifest + CWS 披露      | —    | 已合规 | 保持                         |
| 3   | local/session Zod；sync 关则 `alarms.clear` | —    | 已合规 | 保持                         |
| 4   | alarm 监听 A4 已提前                        | —    | 已合规 | 保持                         |
| 5   | external handoff 归并 IDB 异步不阻塞官网    | P1   | 不采纳 | 设计如此                     |
| 6   | 无 `storage.quota` 监控                     | P2   | 延后   | —                            |

---

### A11 · externally_connectable

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                          | 严重 | 状态   | 处置 / 备注                         |
| --- | ------------------------------------------- | ---- | ------ | ----------------------------------- |
| 1   | origin 白名单与 manifest 双份硬编码         | P0   | 已修   | `externally-connectable-origins.ts` |
| 2   | session handoff 后 IDB 归并未等 bootstrap   | P0   | 已修   | `external-auth-handoff.ts`          |
| 3   | 仅 `YIVENO_AUTH_*` Zod；CWS 已披露          | —    | 已合规 | 保持                                |
| 4   | `onMessageExternal` SW 入口可早于 bootstrap | —    | 已合规 | session 立即 ok                     |
| 5   | listener 无 `removeListener`                | P1   | 不采纳 | SW 单次生命周期                     |

---

### A12 · Icons / CSP

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                | 严重 | 状态    | 处置 / 备注         |
| --- | --------------------------------- | ---- | ------- | ------------------- |
| 1   | icon16/32/48/128 存在且尺寸正确   | —    | 已合规  | PNG IHDR 校验       |
| 2   | `icons` ↔ `action.default_icon`   | —    | 已合规  | 权威表              |
| 3   | 无自定义放宽 CSP / sandbox        | —    | 已合规  | MV3 默认            |
| 4   | 扩展页仅 `type=module`；无 `eval` | —    | 已合规  | 契约单测            |
| 5   | content_scripts 无远程/内联 CSS   | —    | 已合规  | 保持                |
| 6   | 各页 HTML favicon 链 icon16/32    | P1   | 延后    | 非商店阻塞          |
| 7   | `node:fs` 打进扩展包（构建阻断）  | P0   | 已修·B2 | icon 契约移回测试侧 |

---

### A13 · Options UI

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                             | 严重 | 状态    | 处置 / 备注                     |
| --- | ---------------------------------------------- | ---- | ------- | ------------------------------- |
| 1   | `options_ui` → `settings.html` + `open_in_tab` | —    | 已合规  | 保持                            |
| 2   | 分区 `?section=` 深链                          | —    | 已合规  | `settings-sections` 单测        |
| 3   | 设置消息走 `background-client`                 | —    | 已合规  | 保持                            |
| 4   | manifest / Vite 入口无权威契约                 | P0   | 已修    | `extension-options-contract.ts` |
| 5   | `openExtensionOptionsPage` 堆重复 Tab          | P0   | 已修    | `focusOrOpenSettingsTab` + 单测 |
| 6   | `open_settings` 无默认快捷键                   | —    | 已合规  | 用户自绑                        |
| 7   | 无 `popstate` 回退同步 `?section=`             | P1   | 已修·B5 | `settings-page-url-sync.ts`     |

---

### A14 · CWS 合规全文

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                                        | 严重 | 状态   | 处置 / 备注                                |
| --- | --------------------------------------------------------- | ---- | ------ | ------------------------------------------ |
| 1   | permissions + host 均在 CWS 有理由                        | —    | 已合规 | 契约单测                                   |
| 2   | content_scripts / omnibox / externally_connectable 已披露 | —    | 已合规 | 补 localhost 端口说明                      |
| 3   | 短描述 ↔ `app_description`                                | —    | 已合规 | 单测锁定                                   |
| 4   | `icon128` 128×128                                         | —    | 已合规 | A12 已验                                   |
| 5   | manifest ↔ CWS 无自动门禁                                 | P0   | 已修   | `chromewebstore-manifest-contract.test.ts` |
| 6   | 商店截图 / promo 未产出                                   | P1   | 延后   | 上架物料                                   |
| 7   | `localhost:8787` 上架前生产包策略                         | P2   | 延后   | 发布前确认                                 |

---

## B — modern-web-guidance

### B1 · Library

**模块状态：** 🔧 · 审计 2026-08-30（含 C 组前置）

| #   | 项                              | 严重 | 状态   | 处置 / 备注                        |
| --- | ------------------------------- | ---- | ------ | ---------------------------------- |
| 1   | 书签 + 摘录双层滚动             | P0   | 已修   | 统一单层 flex 滚动                 |
| 2   | scroll 无 rAF 合并              | P0   | 已修   | `use-library-virtual-scroll.ts`    |
| 3   | 摘录 Tab 全量 `v-for` 无虚拟化  | P0   | 已修   | `ExcerptLibraryList.vue`           |
| 4   | detail export 多选触发全表重绘  | P1   | 已修   | `shallowRef` + `v-memo` + 行预计算 |
| 5   | 书签树已有虚拟列表              | —    | 已合规 | 复用 stride 基建                   |
| 6   | `content-visibility` 作叠加优化 | P2   | 延后   | 虚拟化已覆盖主路径                 |

---

### B2 · Side Panel Recall

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                  | 严重 | 状态   | 处置 / 备注                  |
| --- | ----------------------------------- | ---- | ------ | ---------------------------- |
| 1   | 单层 flex 滚动                      | —    | 已合规 | 保持                         |
| 2   | `background-client` 合规            | —    | 已合规 | 保持                         |
| 3   | 空态 / composer a11y                | —    | 已合规 | 无 `Search` 文案             |
| 4   | `scroll` 同步读布局                 | P0   | 已修   | `recall-shell-scroll.ts` rAF |
| 5   | 长对话 turn 无 `content-visibility` | P0   | 已修   | `RecallConversation.vue`     |
| 6   | 会话线程未虚拟化                    | P1   | 延后   | 会话通常短                   |
| 7   | Show more 仍全量 DOM                | P2   | 延后   | 与 B3 重叠                   |

---

### B3 · Recall 结果卡

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                        | 严重 | 状态   | 处置 / 备注                  |
| --- | ----------------------------------------- | ---- | ------ | ---------------------------- |
| 1   | TTE `evidenceVisible` 在 `onMounted` 即发 | P0   | 已修   | IO 可见后再发                |
| 2   | 候选列表无 `v-memo`                       | P0   | 已修   | `recall-result-card-memo.ts` |
| 3   | 长列表卡无 `content-visibility`           | P0   | 已修   | card group                   |
| 4   | 点击 / evidence / favicon 内联无单测      | P0   | 已修   | 抽纯函数 + 单测              |
| 5   | hover 无几何变换                          | —    | 已合规 | 保持                         |
| 6   | 长 Show more 列表仍全量 DOM               | P1   | 延后   | —                            |
| 7   | `toMatchCard` 仍在 `SidePanel.vue`        | P2   | 延后   | 未抽测                       |

---

### B4 · Capture / 划词

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                          | 严重 | 状态   | 处置 / 备注                       |
| --- | ------------------------------------------- | ---- | ------ | --------------------------------- |
| 1   | `selection-toolbar-guards` 未接入 `main.ts` | P0   | 已修   | 附注模式滚动不误关                |
| 2   | `handleScroll` 无 rAF                       | P0   | 已修   | `selection-toolbar-scroll.ts`     |
| 3   | `SHOW_DELAY_MS` 重复常量                    | P0   | 已修   | `SELECTION_TOOLBAR_SHOW_DELAY_MS` |
| 4   | 操作行无 `role=toolbar` / aria              | P0   | 已修   | Save + Add note 拼 label          |
| 5   | Shadow 硬编码品牌色                         | P2   | 延后   | content 隔离                      |
| 6   | 滚动仅收起不重锚                            | P1   | 不采纳 | 产品既定                          |

---

### B5 · Settings

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                 | 严重 | 状态   | 处置 / 备注                              |
| --- | ---------------------------------- | ---- | ------ | ---------------------------------------- |
| 1   | 浏览器后退/前进后分区不同步        | P0   | 已修   | `popstate` + `settings-page-url-sync.ts` |
| 2   | 两个 `visibilitychange` 重复       | P0   | 已修   | `settings-visibility-refresh.ts`         |
| 3   | URL 同步逻辑无单测                 | P0   | 已修   | 纯函数单测                               |
| 4   | 长分区无 `content-visibility`      | P0   | 已修   | `.settings-block`                        |
| 5   | 单层 panel + `background-client`   | —    | 已合规 | 保持                                     |
| 6   | tab 切换仅 `replaceState` 无历史栈 | P1   | 延后   | —                                        |
| 7   | `Settings.vue` 单体过大            | P2   | 延后   | —                                        |

---

### B6 · Getting Started

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                   | 严重 | 状态   | 处置 / 备注                   |
| --- | ------------------------------------ | ---- | ------ | ----------------------------- |
| 1   | 进度推导内联无单测                   | P0   | 已修   | `getting-started-progress.ts` |
| 2   | Save / Try Recall 门禁内联           | P0   | 已修   | `getting-started-actions.ts`  |
| 3   | 回前台可能漏刷新进度                 | P0   | 已修   | `visibilitychange`            |
| 4   | 步骤卡片无 `content-visibility`      | P0   | 已修   | 对齐 B5                       |
| 5   | `install-onboarding` 已有单测        | —    | 已合规 | 保持                          |
| 6   | 成功态依赖 storage 非即时 recallDone | P1   | 延后   | —                             |
| 7   | 无独立 manifest 契约                 | P2   | 不采纳 | icons-csp 已覆盖 HTML         |

---

### B7 · App\* 共享 UI

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                       | 严重 | 状态   | 处置 / 备注                    |
| --- | ---------------------------------------- | ---- | ------ | ------------------------------ |
| 1   | `AppSectionTabs` 键盘逻辑内联无单测      | P0   | 已修   | `app-section-tabs-keyboard.ts` |
| 2   | Modal trap 未过滤 hidden / `aria-hidden` | P0   | 已修   | `isElementFocusableVisible`    |
| 3   | trap 缺 Shift+Tab 回归                   | P0   | 已修   | 单测                           |
| 4   | hover 延迟 magic number                  | P0   | 已修   | `APP_HOVER_MENU_*`             |
| 5   | AppButton/Switch/Tabs hover 无几何变换   | —    | 已合规 | 保持                           |
| 6   | Menu chevron `rotate`、Dock `translateY` | P2   | 不采纳 | open 态 / 浮层入场例外         |
| 7   | AppSwitch thumb 用 `left` 过渡           | P1   | 延后   | —                              |
| 8   | 无 Storybook                             | P2   | 延后   | —                              |

---

### B8 · i18n / a11y 横切

**模块状态：** 🔧 · 审计 2026-08-30

| #   | 项                                      | 严重 | 状态                      | 处置 / 备注                        |
| --- | --------------------------------------- | ---- | ------------------------- | ---------------------------------- | ------ | ---- |
| 1   | 关键 i18n 门禁仅 Side Panel             | P0   | 已修                      | `bootExtensionPage` 五页统一       |
| 2   | 各页 `main.ts` 仅 `applyDocumentLocale` | P0   | 已修                      | lang/title + 关键 key warn         |
| 3   | 图标控件 title/aria 无共享契约          | P0   | 已修                      | `icon-only-control-a11y.ts`        |
| 4   | 产品面 Search 禁用无门禁                | P0   | 已修                      | `assertProductSurfaceLabelAllowed` |
| 5   | `t()` 无 `                              |      | `兜底、无直连`getMessage` | —                                  | 已合规 | 保持 |
| 6   | en messages 无 Search                   | —    | 已合规                    | `i18n:check` 521 key               |
| 7   | 全量 en messages 未扫禁用词             | P1   | 延后                      | 仅关键页启动门禁                   |
| 8   | content script 浮层未接 boot 门禁       | P2   | 延后                      | 独立 bundle                        |

---

## 跨模块待办索引（P1/P2 · 延后）

| 模块 | #   | 项                                            | 严重 |
| ---- | --- | --------------------------------------------- | ---- |
| A3   | 6   | `open_library` / `open_settings` 失败无 badge | P1   |
| A3   | 7   | `extension-tab` 全量 tabs.query               | P2   |
| A4   | 6   | bootstrap 失败仅打日志                        | P2   |
| A5   | 6   | `GET_BOOKMARK_LIBRARY_TREE` 内联解析          | P1   |
| A5   | 7   | offscreen PING `return true`                  | P2   |
| A9   | 6   | 读 ingest 设置前短暂无监听                    | P1   |
| A10  | 6   | 无 storage.quota 监控                         | P2   |
| A12  | 6   | HTML favicon                                  | P1   |
| A14  | 6   | 商店截图 / promo                              | P1   |
| A14  | 7   | localhost:8787 生产包策略                     | P2   |
| B1   | 6   | Library content-visibility 叠加               | P2   |
| B2   | 6   | 会话线程未虚拟化                              | P1   |
| B2   | 7   | Show more 全量 DOM                            | P2   |
| B3   | 6   | Show more 全量 DOM                            | P1   |
| B3   | 7   | `toMatchCard` 未抽测                          | P2   |
| B4   | 5   | Shadow 硬编码品牌色                           | P2   |
| B5   | 6   | tab 无 pushState 历史栈                       | P1   |
| B5   | 7   | Settings.vue 过大                             | P2   |
| B6   | 6   | 成功态依赖 storage                            | P1   |
| B7   | 7   | AppSwitch thumb `left`                        | P1   |
| B7   | 8   | 无 Storybook                                  | P2   |
| B8   | 7   | 全量 en 扫禁用词                              | P1   |
| B8   | 8   | content script boot 门禁                      | P2   |

---

## 维护纪律

1. **新模块审计：** 在本文件新增 `### {id}` 小节，先填只读表（状态先标 **延后** 或 **已合规**），再挑 P0 实现。
2. **P0 落地后：** 将对应行 **状态** 改为 **已修**，路线图该模块标 🔧。
3. **它模块修掉：** 标 **已修·{id}**，并在跨模块索引删除或注明。
4. **结案：** 模块无 **延后** 项，或全部明确 **不采纳** → 路线图标 ✅。
5. **会话汇报：** 可贴模块子表摘要；**以本文件为唯一完整台账**。
