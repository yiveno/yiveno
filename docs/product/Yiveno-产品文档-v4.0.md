# Yiveno 产品文档 v4.0

> **唯一**产品/架构规格正文。主要读者：AI 编程工具与维护者。  
> **Normative（必须遵守）**= §0–§7。**Non-normative（背景，勿当实现范围）**= 附录 A。  
> 工程细则可旁挂 `.cursor/rules/project.mdc` / `AGENTS.md`；与本文冲突时以**本文 Normative**为准，并回写 rules。

---

## 0. AI Quick Contract（先读完再改代码）

### 0.1 产品一句话

Yiveno = **个人信息寻回系统**（Capture 低负担 + Recall 高确定性）。**不是**书签管理器 / 聊天机器人 / AI 自动整理工具。

### 0.2 MUST

1. UI → 只经 `background-client` / `chrome.runtime.sendMessage`；shape：`{ scope: 'background', type, payload? }`。
2. Chrome API（bookmarks/tabs/contextMenus/…）只在 `frontend/src/background/**`（及 SW 调用的 infrastructure browser 封装）。
3. IndexedDB 只经 `indexedDBManager`（`frontend/src/infrastructure/indexeddb/manager.ts`）。
4. 领域类型以 Zod 为准：`frontend/src/core/memory/*`；消息类型以 `frontend/src/core/messaging/*` 为准。**禁止发明新 message `type` 字符串**，先改 schema 再接线。
5. 对外文案：**筛选 / 找回**；禁止 **搜索 / Search**（各 locale 译文均遵守）。
6. 扩展用户可见文案：仅经 **`chrome.i18n` + `_locales/{en,zh_CN}/messages.json`** 与 `t()`（`frontend/src/infrastructure/i18n/`）。**禁止**在代码中写死 UI 自然语言，也禁止 `getMessage(...) || '兜底文案'`。`core` 不直接调 `chrome.i18n`（注入 `t` 或返回 message key）。官网 `website/` 不走本方案。
7. `:hover|:focus|:active` 禁止 `translate` / `scale` / `rotate`；只用背景 / opacity / shadow / outline / state layer（浮层入场与 pop/shake 例外见 §3）。
8. 实现范围以 **§1 状态表**为准；未标「已上线」= 不得当成已有行为，也不得在 UI 暗示已可用。
9. Free/当前：仅 **关键词 Filter**。**Hybrid / embedding / LLM 不是当前默认实现范围**（见 §5）。
10. UI 图标：**Material Symbols Outlined**；按需内联于 `frontend/src/infrastructure/ui/icons/`，经 `MaterialSymbolIcon` / `md-icon-button` 使用。禁止另引 Lucide/Font Awesome 等第二套图标体系；禁止依赖 Google Fonts CDN（扩展离线）。

### 0.3 MUST NOT

- 恢复旧双面板书签树、侧边栏管理页、AI 智能重构/聚类主卖点、以「管理书签」为中心的 UI。
- UI 直连 `indexedDB.open` / `chrome.bookmarks.*` / `chrome.tabs.*`。
- 在 Service Worker 使用 `window` / `document` / `localStorage`。
- 把附录 A（愿景/商业化/品牌）当成要立刻实现的功能列表。
- 默认上传用户内容到云端或第三方 AI。

### 0.4 当前优先实现项（Phase A）

**记忆库轻浏览已上线**（`library.html`；左侧类型 Tab，默认书签）。摘录可软删；摘录详情、线索解释 / 空状态、Omnibox、快捷键、Settings、划词浮层已上线。

**说明：** 页内左侧类型切换 ≠ 旧「侧边栏管理页」/书签树；禁止整理中心化回潮。

**下一项：按用户指定推进。** 未指定前不擅自开 Phase B。

**入口能力差异（Normative）：** 共用同一 `recallService` / Filter；壳不同——Omnibox 为单次命中、无会话；快捷键找回打开 Popup（可会话壳）；Popup 预留多轮补充与反馈（Phase B），不得做成开放聊天。书签 Capture：**仅** Chrome 原生加书签 + 导入/增量 sync，不提供「保存当前页」快捷键或 Popup 按钮。快捷键改绑：Settings → Chrome 原生 `chrome://extensions/shortcuts`（扩展无法自行改键）。

### 0.5 权威路径速查

| 主题                         | 路径                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| MemoryItem / clues / payload | `frontend/src/core/memory/`                                  |
| Background 消息联合类型      | `frontend/src/core/messaging/background-messages.ts`         |
| UI 发消息                    | `frontend/src/infrastructure/messaging/background-client.ts` |
| SW 分发                      | `frontend/src/background/handlers/message-handler.ts`        |
| Recall                       | `frontend/src/application/recall/recall-service.ts`          |
| Omnibox                      | `frontend/src/background/listeners/omnibox.ts`               |
| Commands（快捷键）           | `frontend/src/background/listeners/commands.ts`              |
| Command ID 契约              | `frontend/src/core/commands/command-ids.ts`                  |
| Settings                     | `frontend/src/pages/settings/Settings.vue`                   |
| Popup                        | `frontend/src/pages/popup/Popup.vue`                         |
| 摘录详情                     | `frontend/src/pages/detail/Detail.vue`                       |
| 记忆库                       | `frontend/src/pages/library/Library.vue`                     |
| UI 图标（Material Symbols）  | `frontend/src/infrastructure/ui/icons/`                      |
| 扩展 i18n（`t` / locales）   | `frontend/src/infrastructure/i18n/` + `public/_locales/`     |

---

## 1. 现状 vs 目标（Normative）

| 能力                             | 状态                 | 说明                                                                            |
| -------------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| Popup 关键词找回                 | 已上线               | Top Pick + Also Possible；扫描上限约 2000                                       |
| 右键保存选区                     | 已上线               | Text Excerpt；非书签的主动 Capture                                              |
| 划词保存浮层                     | 已上线               | Content Script；Settings 可关；默认开；成功/失败临时 badge                      |
| Chrome 书签导入 + 增量 sync      | 已上线               | 书签唯一写入主路径；原生加书签 → onCreated 同步                                 |
| LocalProfile / ownerId           | 已上线               | 未登录可用                                                                      |
| Settings                         | 已上线（最小）       | `options_ui`；快捷键查看+跳转原生改键页；隐私/同步/AI/账户仅标注未上线          |
| Offscreen                        | 占位                 | 预留 embedding                                                                  |
| Omnibox 找回                     | 已上线               | 关键词 `yi`；共用 `recallService`；单次无会话                                   |
| 快捷键找回                       | 已上线               | `_execute_action`（默认 `Alt+Shift+Y`）开 Popup                                 |
| 手动「保存当前页」               | 不做                 | 与 Chrome 原生书签重复；已移除 UI/快捷键/消息                                   |
| 结果线索解释强化                 | 已上线               | 主因「因字段含「token」」+ 次要字段；Top Pick 线索回显                          |
| Popup 空状态分层                 | 已上线               | 空库 / 有库 idle 与 no_match 分文案；有库可「缩短后再试」                       |
| 摘录详情落地页                   | 已上线               | `detail.html?id=`；摘录打开详情；书签仍直开 URL；`GET_MEMORY_ITEM`              |
| 记忆库轻浏览                     | 已上线               | `library.html`；书签=Chrome 目录只读树；摘录=时间列表；Tab 经 `?type=` 刷新保留 |
| 摘录删除                         | 已上线               | 软删 `deletedAt`；记忆库列表 / 详情页；`DELETE_MEMORY_ITEM`；书签不经此删       |
| Hybrid Filter                    | 目标 · Phase B / Pro | 非 Free                                                                         |
| 反馈闭环 / 低置信追问            | 目标 · Phase B       |                                                                                 |
| 云同步 / 账号 UI                 | 目标 · Phase C       | AccountBinding 已预留                                                           |
| 分享                             | 目标 · Phase C       |                                                                                 |
| 轻管理余项（标签/失效链接/统计） | 目标 · Phase D       | 摘录删除已提前上线；书签仍只经 Chrome 同步软删                                  |

---

## 2. 领域契约（Normative）

权威实现：`frontend/src/core/memory/*`。文档与 Zod 冲突 → **先改一方并立刻对齐另一方**。

### 2.1 可写入类型（MVP）

`bookmark` | `text_excerpt`  
预留不可写：`image` | `video` | `note` | `file`

### 2.2 公共字段

`id`, `ownerId`, `sourceLocalProfileId`, `clues`, `createdAt`, `updatedAt`, `deletedAt?`

- `ownerId` = `accountId ?? localProfileId`
- `CaptureEntry` = `popup` | `context_menu` | `selection_toolbar` | `omnibox` | `shortcut` | `sync` | `import`

### 2.3 Payload（必填摘要）

- **Bookmark**：`title`, `url`, `domain`；可选 favicon / chromeBookmarkId / parentFolderId / chromeCreatedAt
- **TextExcerpt**：`selectedText`, `sourceUrl`, `pageTitle`, `domain`；可选 contextBefore/After
  - **展示（Normative）**：无强制标题；`selectedText` 为主内容；`pageTitle` / `domain` 仅作出处。用户自拟备注标题属后续能力，未上线前不得用页名冒充标题。

### 2.4 Clues

写入尽量填 `title` / `textExcerpt` / `sourceUrl` / `domain` / `captureEntry`。  
`embedding` 当前不生成。行为字段 `openCount` / `lastOpenedAt` 默认 0/null。

### 2.5 身份

`LocalProfile` + 可选 `AccountBinding`（`frontend/src/core/identity/`）。未登录不阻塞 Capture/Recall。

---

## 3. UI 与术语（Normative）

- 文案：筛选 / 找回；禁止 Search / 搜索。
- 交互态禁止几何变换（§0.2）；例外：浮层入场短动画；`pop`/`shake` 不可用于行 hover。
- 空状态：无记忆时引导保存或等待导入，不空白报错。
- 受限页（`chrome://` 等）保存失败 → 明确文案。
- 无选区 → 不提供「保存选区」。
- 重复 URL：MVP 允许并存。

---

## 4. 消息协议（Normative）

- `scope` 必须为 `'background'`（`BACKGROUND_MESSAGE_SCOPE`）。
- **已登记 type（禁止擅自增删拼写）：**

| type                                | 用途                          |
| ----------------------------------- | ----------------------------- |
| `PING`                              | 探活                          |
| `GET_LOCAL_IDENTITY`                | 本地身份 + ownerId            |
| `CAPTURE_BOOKMARK`                  | 写入书签记忆（sync/内部）     |
| `CAPTURE_TEXT_EXCERPT`              | 写入摘录                      |
| `LIST_MEMORY_ITEMS`                 | 列表                          |
| `GET_MEMORY_ITEM`                   | 按 id 读取单条 MemoryItem     |
| `DELETE_MEMORY_ITEM`                | 软删 MemoryItem（当前仅摘录） |
| `RECALL_WITH_CLUE`                  | 线索找回                      |
| `GET_CHROME_BOOKMARK_IMPORT_STATUS` | 导入进度                      |
| `GET_BOOKMARK_LIBRARY_TREE`         | 记忆库书签目录树（只读）      |
| `GET_EXTENSION_COMMANDS`            | 读取命令与快捷键绑定          |
| `OPEN_CHROME_SHORTCUTS_PAGE`        | 打开 Chrome 快捷键设置页      |
| `GET_USER_SETTINGS`                 | 读取用户设置                  |
| `UPDATE_USER_SETTINGS`              | 更新用户设置                  |

新增能力：先改 `frontend/src/core/messaging/*` + handler，再改 UI。

**失败响应（演进契约）：** 面向用户的失败须带稳定 **`errorCode`**（英文枚举常量）；UI 经 `t()` 按 code 渲染文案。**禁止**用本地化 `error` 字符串做控制流分支（例如 `error.includes('未找到')`）。可选字段 `error` 仅供调试，不得作为 UI 主文案或分支依据。

**消息域 `errorCode`（已落地）：**

| 域       | code                                                     | 含义                        |
| -------- | -------------------------------------------------------- | --------------------------- |
| Memory   | `MEMORY_NOT_FOUND`                                       | 记忆不存在或已删            |
| Memory   | `MEMORY_DELETE_BOOKMARK_FORBIDDEN`                       | 书签不可经扩展软删          |
| Memory   | `MEMORY_OPERATION_FAILED`                                | 其它 Memory 操作失败        |
| Memory   | `CAPTURE_UNSAVABLE_PAGE`                                 | 不可保存选区的页面          |
| Memory   | `CAPTURE_EMPTY_SELECTION`                                | 选区为空                    |
| Recall   | `RECALL_FAILED`                                          | 线索找回失败                |
| Settings | `SETTINGS_READ_FAILED` / `SETTINGS_UPDATE_FAILED`        | 读写用户设置失败            |
| Import   | `IMPORT_STATUS_READ_FAILED` / `LIBRARY_TREE_READ_FAILED` | 导入状态 / 书签树读取失败   |
| Commands | `COMMANDS_READ_FAILED` / `SHORTCUTS_PAGE_OPEN_FAILED`    | 快捷键列表 / 打开设置页失败 |
| Identity | `IDENTITY_READ_FAILED`                                   | 本地身份读取失败            |
| Dispatch | `UNKNOWN_MESSAGE_TYPE` / `MESSAGE_DISPATCH_FAILED`       | 未知消息或分发未捕获异常    |

书签 bulk 导入持久状态失败时写 `errorCode: BOOKMARK_IMPORT_FAILED`（`ChromeBookmarkImportState`）。

schema：`frontend/src/core/messaging/*`、`chrome-bookmark-import-state.ts`。

---

## 5. 功能优先级与验收（Normative）

### 5.1 能力分层

| 层          | 召回                         | 阶段             |
| ----------- | ---------------------------- | ---------------- |
| Free / 当前 | 关键词 Filter                | 已上线           |
| Pro         | Hybrid（关键词 + embedding） | Phase B          |
| LLM 增强    | 摘要/解释/追问等             | Phase B+；可关闭 |

冲突时以本表为准：**Hybrid ≠ 当前 P0 默认工作**。

### 5.2 已交付基线验收

1. Popup 可开；空线索无误命中。
2. Chrome 加书签或导入完成后，标题/域名片段可 Top Pick 找回。
3. 右键摘录后可用摘录词找回。
4. 书签导入有真实进度或明确失败；导入项可找回。
5. Chrome 侧书签变更后，再次 Recall 可见一致结果。
6. 无 Search 文案；无行级位移/缩放 hover。
7. 无「保存当前页」用户入口（Popup / 快捷键 / 消息）。

### 5.3 Phase A（Omnibox / 快捷键）验收

1. Omnibox 触发后策略与 Popup 一致（同一 `recallService`）。
2. 不引入第二套搜索/筛选实现。
3. Omnibox / 快捷键 §1 状态已更新为已上线。
4. Omnibox 入口为单次命中：建议列表 → 打开 URL；无追问/会话。
5. 快捷键找回：`_execute_action` 打开 Popup；不经 `onCommand` 自建第二套找回。
6. 不提供「保存当前页」快捷键/消息；书签靠 Chrome 原生 + 导入/增量 sync。
7. 新自定义命令须先改 `core/commands/command-ids.ts` + manifest，再注册 handler。

### 5.4 后续优先级（摘要）

- **P0 / Phase A**：线索解释/空状态、摘录详情、记忆库轻浏览 **已完成**；下一项用户指定
- **P1 / Phase B**：索引、embedding、Hybrid、反馈、Need A Clue
- **P2 / Phase C**：分享、云同步、账户 UI；Settings 隐私/同步/AI/账户分区落地
- **P3 / Phase D**：标签/失效链接/统计等轻管理余项（摘录删除已提前上线）

**禁止重做**：双面板重组、复杂拖拽整理、AI 聚类主卖点、大规模书签树编辑。

### 5.5 Settings IA（最小已上线）

| 分区   | 状态   | 说明                                               |
| ------ | ------ | -------------------------------------------------- |
| 保存   | 已上线 | 划词浮层开关（默认开）                             |
| 快捷键 | 已上线 | 展示绑定；改键跳转 `chrome://extensions/shortcuts` |
| 隐私   | 未上线 | 仅占位文案，不暗示可用                             |
| 同步   | 未上线 | 同上                                               |
| AI     | 未上线 | 同上                                               |
| 账户   | 未上线 | 同上                                               |

### 5.6 扩展入口

| 入口            | 现状                                                  |
| --------------- | ----------------------------------------------------- |
| `popup.html`    | 活跃；可打开 Settings                                 |
| `background.js` | 活跃                                                  |
| `settings.html` | 已进 `options_ui`（`open_in_tab: true`）              |
| content script  | 已注册；`content-selection-toolbar.js`（http/https）  |
| offscreen 源码  | 占位；未注册 permission；embedding 接入前不启用       |
| Omnibox         | 已注册；keyword `yi`                                  |
| `commands`      | 已注册；找回 `Alt+Shift+Y`（`_execute_action`，可改） |

---

## 6. 架构（Normative）

```text
Chrome API / 选区
  → Background（唯一监听者）
  → IndexedDB（indexedDBManager）
  →（可选 Pinia；Popup 可用组件状态）
  → Vue（pages/；可收敛 presentation/）
  → sendMessage → Background
```

- 依赖：`pages|presentation → application → core`；`application` → `infrastructure`。
- UI 访问 Background：**仅** messaging client。
- 导入 = 核心业务（真实进度）。embedding = 辅助（Offscreen/队列，不阻塞关键词 Recall）。
- 目标规模指导：2 万 MemoryItem；MVP 可限扫 ~2000，全量索引 Phase B。
- 长期：Cloud Memory DB 为云端事实源；本地 IndexedDB 变缓存——**不提前重写本地链路**。
- **禁止回潮**：旧管理页/侧边栏/书签树编辑/AI 自动整理进 build 或 manifest。

新功能顺序：契约 → repository → Background 消息 → Recall/Filter → UI。

---

## 7. 找回体验（Normative 要点）

```text
线索 →（MVP 规范化）→ 关键词 Filter → 排序
  → Top Pick + Also Possible → 打开
  →（Phase B）反馈写回
```

| 形态          | MVP                                    |
| ------------- | -------------------------------------- |
| Top Pick      | 已有（分数达阈值）                     |
| Also Possible | 已有（约 ≤5）                          |
| Need A Clue   | Phase B                                |
| No Match      | 已有；空库引导 Capture；有库可缩短再试 |

原则：能命中不追问；追问最多一个；卡片要有线索不只标题 URL；否定后再补救对话。

---

## 8. 路线图（剩余工作 · Normative 排序）

| Phase | 内容                                                               |
| ----- | ------------------------------------------------------------------ |
| **A** | 线索解释/空状态、摘录详情、记忆库轻浏览 **已完成**；其余按用户指定 |
| B     | 索引、Offscreen embedding、Hybrid（Pro）、反馈、追问               |
| C     | Sync、账户 UI、隐私控制落地、分享                                  |
| D     | 轻管理余项（标签/失效链接/统计；摘录删除已提前）                   |

---

## 附录 A · Non-normative（背景；勿当 sprint 范围）

### A.1 定位与信念

承诺：看到有价值内容就扔进 Yiveno；只记得一点点也能找回。  
信念：要的是未来能用，不是整理；对话非主路径；AI 是寻回引擎不是产品主体。

目标用户：知识工作者、开发者/设计师、学生等「存过但找不到」人群。  
北极星：模糊线索 → 第一屏「对，就是这个。」

MVP 验证问题：是否更愿保存、是否优先打开 Yiveno、是否稳定 Recall、是否愿为语义/同步付费。

### A.2 隐私原则（产品方向）

默认：只处理主动保存 + 授权同步的书签；不默认浏览历史/全文快照/上传第三方。  
逐步提供：本地/云端开关、删云端、导出、关 AI、模型说明。云端/语义上线前补隐私政策与同意流。

### A.3 商业化方向（配额另定）

- Free：本地、关键词 Filter、基础捕获、书签导入。
- Pro：语义 Hybrid、同步、更高配额、反馈排序、分享。
- 更高级：云端深寻回、多模态、快照额度、团队。

### A.4 品牌

禁：AI Bookmark Manager、管理你的书签、自动整理一切、永久保存看过的所有内容。  
荐：找回曾保存的重要内容；只记得一点点也能找回；Save what matters. Recall it later.

### A.5 Text Excerpt 明确不做

富文本高亮、完整网页快照、自动保存全部阅读、类 Readwise 复习系统。

---

## 修订记录

| 日期       | 变更                                                                              |
| ---------- | --------------------------------------------------------------------------------- |
| 2026-07-25 | i18n Phase 5：清残留 UI 硬编码；CI `i18n:check`；catch 不再展示 `error.message`   |
| 2026-07-25 | i18n Phase 4：Settings/Recall/Import/Commands/Identity 失败响应落地 `errorCode`   |
| 2026-07-24 | i18n Phase 2：Library/Detail 文案；Memory 失败响应落地 `errorCode`                |
| 2026-07-24 | 扩展 i18n 契约：`chrome.i18n` + `en`/`zh_CN`；`t()`；失败响应演进为 `errorCode`   |
| 2026-07-24 | 摘录展示：无强制标题；正文为主、页名/域名仅出处（记忆库/Popup/Omnibox/详情）      |
| 2026-07-24 | UI 图标选型：Material Symbols Outlined 按需内联；记忆库删除改为 hover 显图标按钮  |
| 2026-07-24 | 摘录软删上线：`DELETE_MEMORY_ITEM`；记忆库列表 / 详情；书签不经此路径删除         |
| 2026-07-24 | 记忆库书签 Tab：完整映射 Chrome 目录只读树；`GET_BOOKMARK_LIBRARY_TREE`           |
| 2026-07-24 | 记忆库轻浏览上线：`library.html` 左侧类型 Tab（默认书签）；Popup/Settings 入口    |
| 2026-07-24 | 摘录详情落地页上线：`detail.html?id=` + `GET_MEMORY_ITEM`；Popup/Omnibox 分流     |
| 2026-07-24 | Phase A：线索解释强化 + Popup 空状态分层（空库/有库 + 缩短再试）                  |
| 2026-07-24 | 摘录保存成功/失败：工具栏临时 badge（✓ / !）；划词与右键共用                      |
| 2026-07-24 | 划词保存浮层上线；Settings 开关默认开启；`captureEntry=selection_toolbar`         |
| 2026-07-24 | Settings 最小可用进 manifest：快捷键查看+跳转原生改键；Popup 入口                 |
| 2026-07-24 | 移除「保存当前页」；书签仅 Chrome 原生+sync；快捷键只保留找回开 Popup             |
| 2026-07-24 | 快捷键已上线：命令契约+registry；找回 Alt+Shift+Y 开 Popup                        |
| 2026-07-24 | Popup 移除「保存当前页」UI；保存改快捷键入口；Omnibox keyword `yi`                |
| 2026-07-24 | Omnibox 已上线（keyword `yi`）；§0.4 入口能力差异；Phase A 下一项改为快捷键       |
| 2026-07-23 | 确立唯一正文；现状矩阵、契约、验收、UI 约束、Hybrid 边界                          |
| 2026-07-23 | AI 优先重排：Quick Contract、Normative/附录分离、消息 type 表、Phase A 单一优先项 |
