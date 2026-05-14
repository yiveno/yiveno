# AcuityBookmarks - 完整产品文档 v3.0

> 📘 **文档目标**：为 AI 编程助手（Cursor / Kiro / Claude 等）提供完整项目上下文，确保生成代码符合本仓库架构与规范。
>
> 🎯 **最后更新**：2026-05-14  
> 📦 **项目版本**：v1.0  
> 🏗️ **架构版本**：v3.0（DDD + 单向数据流 + 现代技术栈）

---

## 📋 目录

- [零、文档治理与 AI 协作](#零文档治理与-ai-协作)
- [第一部分：产品概述](#第一部分产品概述)
  - [1.1.1 Hover 与指针交互（Material Design 3）](#interaction-hover)
- [第二部分：技术架构](#第二部分技术架构)
  - [2.1.4 插件与官网（认证与会话）](#extension-website-auth)
- [2.5 Theming runbook - 换肤与主题操作清单](#25-theming-runbook-换肤与主题操作清单)
- [2.5.5 官方配色预设（与代码同步）](#255-官方配色预设与代码同步)
- [第三部分：核心功能](#第三部分核心功能)
- [第四部分：开发规范](#第四部分开发规范)
  - [4.1.2.1 Hover 与指针交互（实现约束）](#4121-hover-与指针交互实现约束)
- [第五部分：数据流设计](#第五部分数据流设计)
- [第六部分：存储方案](#第六部分存储方案)
- [第七部分：关键实现细节](#第七部分关键实现细节)
- [第八部分：测试与质量保障](#第八部分测试与质量保障)

---

## 零、文档治理与 AI 协作 {#doc-governance}

本仓库**长期由 AI IDE（Cursor / Kiro / 其他）辅助开发**，易产生多套 **rules** 与大量过程性 Markdown。**本节为「写什么、信什么、删什么」的硬约定**，与代码具有同等效力。

> **说明（2026-05）**：原 `docs/PHASE*.md` 及 `docs/development/` 下多数阶段性「完成报告」已从仓库删除，避免与正文双源；细节以 **Git 提交历史** 为准。

### 0.1 单一产品正文（规格唯一出口）

| 类型 | 路径 | 说明 |
|------|------|------|
| **产品 + 架构 + 交互 + 开发规范（正文）** | `docs/product/AcuityBookmarks-产品文档-v3.0.md` | **唯一**需要与「当前真实实现」持续对齐的规格文档；架构/数据流/UI 约定/质量门禁等**以本文件为准**。 |
| IDE 规则 | `.cursor/rules/project.mdc`、`.kiro/steering/*.md` | **执行层**：行为约束、速查表；**不得**与产品正文冲突；若冲突**以本文件为准**并应立刻改 IDE 规则。 |
| 运维/接入说明（非产品规格） | 如 `docs/AUTH_GUIDE.md` | 操作步骤类可暂存；**与正文冲突时以正文为准**；结论性内容应迁回正文后删或缩为链接。 |
| 阶段复盘 / 历史 | ~~`docs/PHASE*.md`~~（**已移除**，考古用 Git）、`docs/archive/*` | **不作为规格引用**；新结论必须写回正文。 |
| 开发事实清单 | `docs/development/`（现仅保留环境变量、依赖移除等**可查表**） | 非产品规格；与正文冲突以正文为准。 |
| 组件 / 模块 README | `frontend/src/**/README.md` 等 | **局部说明**（用法、边界），不替代正文。 |
| Material 清单与迁移备忘 | `frontend/MATERIAL_WEB_COMPONENTS_GUIDE.md` 等 | **实现备忘**；与正文重复时以**代码与本文件**为准。 |

**禁止**：在仓库根目录或 `frontend/` 根目录再新增 `*_PROGRESS.md`、`*_MIGRATION_COMPLETE.md`、`*_SUMMARY.md` 等平行「产品规格」类文档；阶段性结论应**写回本文件**或仅存于 **Git 提交说明**，不再在 `docs/` 根目录堆积「PHASE 完成报告」类 Markdown。

### 0.2 与 AI IDE 的协作原则

- **需求与迭代**：新能力、改架构、改数据流 → **先改本文件相关章节，再改代码**（或同一 PR 内同时完成）。
- **Rules 同步**：修改正文中的「铁律 / 门禁 / 目录结构」时，**必须**同步检查 `.cursor/rules/project.mdc` 与 `.kiro/steering/project.md`（及与本仓库相关的其他 steering），避免双口径。
- **国际化（i18n）**：开发与校验流程见 `frontend/docs/i18n-implementation-guide.md`、`frontend/docs/i18n-workflow.md`；日期/时间类展示须走统一工具与语言环境，校验清单见 `frontend/docs/time-i18n-checklist.md`；脚本见 `frontend/package.json` 中 `i18n:*`；**不再**维护 `i18n-batch-*.md` 类批次记录。
- **前端 `frontend/docs/`**：除上述 **3 份 i18n 相关**长期文档外，**不**再堆积过程性说明；阶段性结论写入本文件对应章节后应删除源 Markdown。
- **瘦身**：历史过程文档**不主动扩张**；已吸收进正文且无引用价值的文件应删除；`frontend/docs/` 下**批次进度类**（如 `i18n-batch-*.md`）不得复活。

### 0.3 前端 `src` 真实顶层结构（与代码一致）

以下为 **2026-05** 仓库实际目录（用于对齐正文中的「分层」描述；**不以**旧文档中的理想树为唯一依据）：

```
frontend/src/
├── pages/              # 各入口页面（popup / side-panel / management / settings …）
├── components/         # Vue 组件（base / business / composite 等）
├── application/        # 应用服务与用例编排
├── core/               # 领域模型与纯逻辑
├── infrastructure/     # IndexedDB、Chrome API、HTTP、日志等
├── background/         # MV3 Service Worker（禁止依赖 Vue/DOM）
├── stores/             # Pinia
├── composables/
├── services/           # 部分跨切能力（与 application 并存时注意依赖方向）
├── presentation/       # 少量遗留/辅助表现层文件（新代码优先走 pages + components）
├── design-system/      # 全局样式与 Material 覆盖
├── config/、constants/、types/、utils/、workers/、offscreen/、content/ …
└── tests/              # Vitest 等
```

**依赖方向**仍遵守正文 **§2.2**（DDD）：表现层 → application → core → infrastructure；`background/` 仅允许引用**无 Vue、无 DOM** 的模块路径（详见 `.cursor/rules` 中的 Service Worker 约束）。

---

## 第一部分：产品概述

### 1.1 产品定位

**AcuityBookmarks** 是一款以 AI 语义检索为核心的 Chrome 书签扩展。

**产品原点**：用户长年累月收藏了大量书签，收藏时不想花时间分类，用的时候又找不到。AcuityBookmarks 解决的就是这个问题——**收藏零摩擦，检索靠语义**，让 AI 替用户记住每一条书签的内容，用户只需要输入脑海中模糊的关键词就能精准找到。

#### 核心设计哲学

> 收藏不需要思考，检索不需要记忆。

- **收藏极简**：快捷键一键收藏当前页，无需选择文件夹
- **检索语义化**：输入自然语言关键词，AI 理解意图精准召回
- **AI 做重活，用户做决策**：整理、分类、清理由 AI 完成，用户只需确认

#### 核心价值主张

- **AI 语义检索**：不记得书签标题也能找到，输入"那篇讲 React 性能的文章"即可召回
- **隐私优先**：书签数据存储在本地 IndexedDB，AI 能力支持用户自带 API Key，数据不经过产品服务器
- **高性能本地**：支持 2 万+ 书签流畅操作，核心功能完全离线可用
- **融入浏览器**：支持 Chrome Omnibox 直接调用，无需打开任何页面

#### 界面与宿主原则（Chrome）

产品能力与 Chrome 书签强绑定，界面策略应与之同向，而非对立。

- **延伸而非另起炉灶**：扩展 UI 应呈现为 **Chrome 书签能力的自然延伸**，降低「又进了一个陌生 App」的认知成本与信任摩擦。
- **气质对齐、像素不必对齐**：与 Chrome / Google 系工具审美谱系协调（如 Material Design 3、语义化设计 token），**不要求**与浏览器外壳或各平台 Chrome 像素级一致；随宿主视觉迭代，以「气质一致、可维护」为准则适度跟进。
- **差异靠信息与品牌**：辨识度通过信息架构、核心能力（语义检索、整理、健康度等）与自有品牌元素建立，**不**以刻意「反 Chrome 味」作为设计目标。

#### 1.1.1 Hover 与指针交互（Material Design 3）{#interaction-hover}

**目标**：指针悬停时，用**可预期的表面反馈**表达「可交互 / 当前指针下是哪一行」，**不**破坏列表扫读节奏与版心稳定。

**与 Material Design 3 的关系**：MD3 将 hover 列为标准 [Interaction states](https://m3.material.io/foundations/interaction/states) 之一，推荐通过 **state layer**（叠在组件表面上的半透明 on-container / on-surface 色层）与**容器属性**（底色、描边、阴影层级）区分状态；**不推荐**在**高密度列表行**上用位移、整行缩放充当 hover 主效果。

**AcuityBookmarks 约定（扩展 / 管理页 / 侧栏等书签列表与类列表 UI）**

| 场景 | 推荐 | 避免 |
|------|------|------|
| 书签树行、搜索结果行、上下文菜单项、筛选标签等**可重复列表行** | 背景色 / 渐变、`outline` / `box-shadow`（含 inset 边框）、Material 组件自带的 **hover state layer** token | `transform: translateY(...)`、`scale(...)` 作用在**整行**或行内大块；`transition: all` 无必要地带动 `transform` |
| 独立 **CTA 按钮**、**图标按钮** | 底色变化、阴影略加重、`opacity`；必要时仅 **水平** 微动（如箭头 `translateX`）表达方向 | 整块卡片 `scale` 随 hover（易与「列表行 hover」混淆） |
| **入场 / 离场**（对话框、下拉、Tooltip） | 短时长 `opacity` + 轻微 `translateY` / `scale` 仅用于**挂载卸载**，与列表 hover 分离 | 将「列表 hover」与「浮层入场」混用同一套位移习惯 |
| **无障碍** | 尊重系统「减少动效」；非必要不动效 | 持续、大幅度的位移动效（易引发前庭不适） |

**实现自检（前端）**

- 在 `BookmarkTree` / `TreeNode`、搜索下拉、设置列表等路径上，**禁止**为 `:hover` 增加**垂直位移**或**整行缩放**。
- `transition` 应枚举具体属性，**避免** `transition: all` 与列表项 hover 绑定导致误过渡 `transform`。
- 工具类动画（`design-system/animations.css` 中的 `pop`、`shake` 等）用于**明确反馈**（成功 / 错误），**不**替代列表 hover 规范。

**文档与代码同步**：新增或改版列表类组件时，须符合本节；审查 PR 时可将上表作为 UI 检查项。

### 1.2 目标用户

**核心用户**：书签积累超过 500 条、懒得手动分类、但需要快速找到的重度网络用户。

具体包括：
- **知识工作者**：研究员、咨询师、产品经理，需要快速找到之前收藏的参考资料
- **内容创作者**：博主、设计师，收藏大量灵感素材但难以检索
- **IT 从业者**：开发者、技术人员，收藏大量技术文档和工具链接
- **学生群体**：收藏学习资料但缺乏整理习惯

**用户核心痛点**：不是不会用书签，而是书签太多、找不到。

### 1.3 功能优先级

功能按优先级排列，开发资源应优先保障高优先级功能的体验质量。

#### P0 - AI 检索（产品核心，不可妥协）

- **Popup AI 搜索框**：打开插件即可输入关键词，AI 语义召回相关书签
- **Chrome Omnibox 集成**：地址栏输入触发词直接调用 AI 检索，零切换成本
- **快捷键一键收藏**：浏览网页时按快捷键立即收藏，无需选择分类

#### P1 - AI 整理（留存关键，体现 AI 价值）

- **AI 自动聚类**：AI 分析书签内容，自动归组相似书签，用户确认即可
- **智能清理**：AI 标记死链、重复书签，用户一键清理
- **管理页面**：展示 AI 整理结果，支持用户轻量确认和微调（而非手动操作台）

#### P2 - 场景扩展（差异化，提升日活）

- **SidePanel 侧边栏**：浏览网页时显示相关书签，支持上下文关联推荐
- **书签分享**：支持分享书签集合/专题页面，作为用户裂变入口

#### P3 - 支撑功能（必要但非重点）

- **设置页面**：AI API Key 配置、功能开关等用户配置项；向量嵌入（Embedding）的生成节奏与配额由产品侧默认策略管理，**不再**提供独立「Embedding 设置」页，相关说明集中在「语义搜索」等开关附近文案。
- **数据统计**：Popup 页面展示书签总数、健康状态等基础指标

### 1.4 AI 能力架构策略

作为个人开发者产品，AI 能力采用**隐私优先 + 成本可控**的分层策略：

#### 第一层：本地检索（免费，始终可用）
- 基于 **FlexSearch** 的高性能模糊筛选（工程内部分 API 仍沿用历史命名 `fuse` / `Fuse`）
- IndexedDB 持久化与索引；无需网络，无成本

#### 第二层：用户自带 API Key（推荐，隐私最优）
- 用户在设置页填入自己的 OpenAI / Claude / Gemini API Key
- 请求从用户浏览器直接发往 AI 服务商，产品服务器不经手任何书签数据
- 隐私宣传点完整保留："你的书签数据只在你的设备和你选择的 AI 服务商之间流动"

#### 第三层：产品托管 AI（付费订阅，便捷优先）
- 用户不想配置 API Key 时，使用产品提供的 AI 服务
- 基于 Cloudflare Workers AI，成本极低
- 付费订阅用户专属

#### 降级策略
```
用户有 API Key → 使用用户 Key（语义搜索）
用户无 API Key → 使用本地 FlexSearch 模糊筛选
网络不可用    → 使用本地 IndexedDB 索引（关键词搜索）
```

---

## 第二部分：技术架构

### 2.1 技术栈概览

#### 2.1.1 前端技术栈

```typescript
{
  // 🔷 核心框架（见 frontend/package.json）
  vue: "^3.5.18",
  pinia: "^3.0.3",
  typescript: "~5.8.3",
  vite: "^8.0.10",

  // 🔷 现代库
  "@tanstack/vue-query": "^5.90.5",
  "@tanstack/vue-virtual": "^3.13.12",
  "@vueuse/core": "^14.0.0",
  "immer": "^10.2.0",
  "mitt": "^3.0.1",
  "zod": "^3.25.8",

  // 🔷 搜索与索引
  "fuse.js": "^6.6.2",
  "flexsearch": "^0.8.212",

  // 🔷 UI 与扩展
  "@material/web": "^2.4.1",

  // 🔷 测试
  "vitest": "^4.0.17",
  "@vue/test-utils": "^2.4.6"
}
```

#### 2.1.2 后端技术栈

```typescript
{
  // Cloudflare Workers
  runtime: "Bun 1.2.21+",           // 高性能 JavaScript 运行时
  platform: "Cloudflare Workers",   // Serverless 平台
  ai: "Cloudflare AI (Workers AI)", // LLM 推理
  database: "Cloudflare D1"         // SQLite 数据库
}
```

#### 2.1.3 Chrome Extension

```json
{
  "manifest_version": 3,
  "minimum_chrome_version": "100",
  "service_worker": "background.js" // Manifest V3
}
```

#### 2.1.4 插件与官网（认证入口与会话同步）{#extension-website-auth}

> 对应已移除的过程说明 `docs/plugin-website-integration.md` 等；**以本节 + 代码为准**，操作步骤类仍见 `docs/AUTH_GUIDE.md`（若与实现不一致以代码为准）。

| 维度 | 约定 |
|------|------|
| **用户登录 / 账户 / 定价等外链** | 统一使用 `frontend/src/config/website.ts` 中的 `websiteUrls` 与 `openWebsiteUrl()`（如 `UserMenu` 跳转登录页）；基地址由 `VITE_WEBSITE_URL` 覆盖，默认生产域为 `https://acuitybookmarks.com`。 |
| **官网与扩展的会话** | 在官网匹配域上注入内容脚本 `auth-sync.js`（源码 `frontend/src/content/auth-sync.ts`）：监听官网 `localStorage` 中 Supabase session（`sb-*-auth-token`），通过 `chrome.runtime.sendMessage` 向 Background 发送 `SYNC_AUTH_SESSION` / `CLEAR_AUTH_SESSION`，由扩展侧持久化并驱动 UI。 |
| **职责边界** | 登录与账户主流程在 **官网（Nuxt `website/`）**；扩展负责书签核心能力、展示登录态与跳转；避免在扩展内再维护一套完整账户注册页（与已删文档中的目标一致，实现路径已演进为 content script 同步而非独立 `auth.html` 页）。 |

### 2.2 DDD 分层架构

AcuityBookmarks 严格遵循 **领域驱动设计（DDD）** 的分层架构：

```
frontend/src/
├── pages/                 # 入口页面（popup / management / side-panel / settings …）
├── components/            # Vue 组件（base / business / composite）
├── presentation/          # 少量遗留表现层文件；**新功能优先**使用 pages + components
├── application/           # 应用服务（bookmark、search、cleanup、settings…）
├── core/                  # 领域与纯逻辑
├── infrastructure/        # IndexedDB、Chrome API、HTTP、日志等
├── background/            # MV3 Service Worker（无 Vue / 无 DOM）
├── stores/                # Pinia
├── composables/、services/、design-system/、config/、types/、utils/、tests/ …
```

> **说明**：与 **§零.0.3** 一致；子包（`packages/design-tokens`、`packages/auth-core`）及 `website/`、`backend/` 见各目录 README；**具体文件名以仓库为准**，上表为架构导航而非穷举。

#### 分层职责与规则

| 层级               | 职责                        | 禁止                                    |
| ------------------ | --------------------------- | --------------------------------------- |
| **Pages / Components** | UI 渲染、用户交互、事件绑定 | 直接访问 Chrome API、直接访问 IndexedDB |
| **Application**    | 业务流程协调、跨领域编排    | 包含 UI 逻辑、直接操作 DOM              |
| **Core**           | 领域模型、业务规则、纯函数  | 依赖外部 API、依赖框架                  |
| **Infrastructure** | 技术实现、外部 API 封装     | 包含业务逻辑                            |

### 2.3 单向数据流架构

**🚨 架构核心原则**：IndexedDB 是整个系统的**唯一数据源**。

```mermaid
graph LR
    A[Chrome Bookmarks API] -->|监听变化| B[Background Script]
    B -->|同步写入| C[IndexedDB]
    C -->|读取| D[Pinia Store]
    D -->|数据绑定| E[Vue Components]
    E -->|用户操作| F[Application Service]
    F -->|发送消息| B
    B -->|调用 Chrome API| A
```

#### 数据流规则

1. **Chrome API → Background Script**
   - 🟢 Background Script 是唯一监听 `chrome.bookmarks.on*` 事件的地方
   - 🟢 所有 Chrome API 的 CRUD 操作必须通过 Background Script

2. **Background Script → IndexedDB**
   - 🟢 Background Script 负责将 Chrome 书签数据同步到 IndexedDB
   - 🟢 支持全量同步（`syncAllBookmarks`）和增量同步（`syncIncremental`）

3. **IndexedDB → UI**
   - 🟢 前端页面从 IndexedDB 读取数据
   - 🔴 禁止前端页面直接读取 Chrome API

4. **UI → Background Script**
   - 🟢 前端通过 `chrome.runtime.sendMessage` 发送 CRUD 请求
   - 🟢 Background Script 执行 Chrome API 操作后自动触发同步

#### 数据同步机制

```typescript
// 示例：Background Script 监听书签创建事件
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  logger.info('书签已创建:', bookmark.title)

  // 1. 增量同步到 IndexedDB
  await bookmarkSyncService.syncIncremental('created', id)

  // 2. 广播消息到所有前端页面
  chrome.runtime.sendMessage({
    type: 'acuity-bookmarks-db-synced',
    eventType: 'created',
    bookmarkId: id,
    timestamp: Date.now()
  })
})
```

### 2.4 构建与部署

#### 2.4.1 开发环境

```bash
# 安装依赖
bun install

# 前端开发（热更新）
bun run dev:frontend

# 前端构建（带热重载）
bun run build:hot

# 类型检查
bun run typecheck:force
```

#### 2.4.2 代码质量

```bash
# ESLint 检查与修复
bun run lint:fix:enhanced

# Stylelint 检查与修复
bun run stylelint:fix:enhanced

# 格式化代码
bun run format
```

### 2.5 Theming runbook - 换肤与主题操作清单

> **目的**：换种子色或整体换肤时，接手人不必猜「色从哪来、该改哪几处」；与 [§1.1 界面与宿主原则（Chrome）](#界面与宿主原则chrome) 一致，以 **Material Design 3 导出 + 项目 token 映射** 为唯一主线。

#### 2.5.1 单一事实来源（读此节即可建立心智模型）

| 层级 | 作用 |
|------|------|
| **`document.documentElement`** | 运行时由 `data-theme`（`light` / `dark`）与 `style.colorScheme` 表达当前亮暗；**禁止**再使用已废弃的 `theme-light` / `theme-dark` 类名手抄变量。 |
| **`packages/design-tokens/src/color-presets.ts`** | **官方配色预设清单**（`ColorPresetId`、种子 Hex、中文名）；与 §2.5.5 表格 **同源**，接入 `data-color-preset` 与设置 UI 时从此导入。 |
| **`packages/design-tokens/css/presets/*.css`** | **六套配色**的亮/暗 `--md-sys-color-*`（由根目录 Builder 导出 + `build-material-color-presets.mjs` 生成）；运行时由 `data-color-preset` 选择。 |
| **`packages/design-tokens/css/material-theme.css`** | 总入口：`@import` 各 `presets/*.css`，并含中等/高对比度与 `color-scheme` 段；**不**再内联整套标准亮/暗色（已拆至 presets）。 |
| **`packages/design-tokens/css/semantic-colors.css`** | 业务语义色（success / warning / info、强调色、primary 阶梯、alpha）由 **`var(--md-sys-color-*)` 与 `color-mix`** 派生；换 M3 导出后一般**只需核对映射**，无需再堆 Hex。 |
| **`frontend/src/design-system/tokens.css`** | 扩展将 `--md-sys-*` / `--acuity-*` 映射为项目对外的 **`--color-*`**（含阴影、遮罩、语义浅底等 P3 集中变量）。换肤后重点检查 **混色与阴影** 是否仍协调。 |
| **`packages/design-tokens/src/colors.ts`** | 供 **无法使用 CSS 变量** 的场景（如控制台样式字符串、Badge API）：`.css` 仍指向变量名；`.rgb` / `.hex` 为与 **默认 preset 亮侧** 一致的近似快照，换 `presets/default.css` 后应**同步校对** `colors.ts`。 |

主题应用逻辑（不负责写死颜色，但换肤后需回归）：`frontend/src/composables/useThemeSync.ts`（同步 `data-theme` 与 `data-color-preset`）、`frontend/src/components/composite/ThemeToggle/ThemeToggle.vue`；**配色预设**在设置页「配色」标签 `frontend/src/pages/settings/sections/ColorPresetSettings.vue` 中选择，经 `frontend/src/infrastructure/global-state/global-state-manager.ts` 写入 `chrome.storage.local` / `sync` 的 `colorPreset` 键。View Transition 与主题相关选择器：`frontend/src/design-system/animations.css`。

**官网（Nuxt）**：`website/nuxt.config.ts` 已引入 `@acuity-bookmarks/design-tokens/css/material-theme.css`；`website/app.vue` 使用 `data-theme`。若官网要与扩展同一套色盘，需与上述 CSS **同源提交**，避免两处分叉。

#### 2.5.2 换肤时要改 / 核对的文件清单

按常见「只换 Theme Builder 种子」工作流排序：

1. **必改（色盘本体）**  
   - **多预设**：`packages/design-tokens/css/presets/*.css` — 由根目录 `Skyline`、`Ocean`、`Forest`、`Ember`、`Twilight`（→ preset `violet`）、`Slate` 中 `light.css` / `dark.css` 经 `bun run build:color-presets`（`scripts/build-material-color-presets.mjs`）生成；**勿手改生成体**，改源 CSS 后重新运行脚本。  
   - **总入口**：`packages/design-tokens/css/material-theme.css` — `@import` 上述 preset，并保留中等/高对比度与 `color-scheme` 段。若仅替换「晴空」单套，可只更新 `Skyline` 源文件后重跑脚本。

2. **强烈建议核对（派生与映射）**  
   - `packages/design-tokens/css/semantic-colors.css` — 确认 `--acuity-*` 仍指向有效的 `--md-sys-color-*`。  
   - `packages/design-tokens/src/colors.ts` — 更新 `materialColors` 及依赖新映射的 `semanticColors` / `accentColors` / `primaryScale` 的 **rgb/hex 快照**（若仅改 CSS 而不改 TS，非 CSS 场景可能仍显示旧色）。

3. **按需核对（项目层）**  
   - `frontend/src/design-system/tokens.css` — 新增或调整的 `--color-*` 是否与新材料角色一致。  
   - `frontend/src/assets/main.css` — 高对比度、调试、打印等分支是否仍使用 token（如 `var(--color-black)`），避免裸色回归。

4. **一般无需为换色而改**  
   - 各业务 `.vue` 内样式：应以 **`var(--color-*)` / `var(--md-sys-color-*)`** 为主；若发现裸 `#` / `rgb(...)`，应迁回 `tokens.css` 集中定义后再引用（见 P3 扫尾约定）。

#### 2.5.3 换肤后必跑命令（CI 前自检）

在仓库根目录安装依赖后，**至少**对扩展前端执行：

```bash
cd frontend
bun run typecheck
bun run lint:check
bun run stylelint:check
```

若修改了 `packages/design-tokens` 下 TypeScript，请同时确认根工作区类型检查策略（如 `bun run typecheck` 是否覆盖该包）；**无单独「换肤编译」脚本**，以现有质量脚本为准。

#### 2.5.4 验收清单（QA）：浅色 / 深色 / 对比度

以下在 **Popup、Side Panel、Management、Settings、Onboarding** 各至少抽查一条主路径；含 **Material Web Components** 的列表、对话框、输入框须重点看边框与 hover。

| 场景 | 操作要点 | 通过标准 |
|------|-----------|----------|
| **浅色** | 设置中选「浅色」或等效项 | `html` 为 `data-theme="light"`（或等价表现）；主表面、主 on-surface 文字与 Chrome 工具栏气质协调；无大块硬编码旧色。 |
| **深色** | 设置中选「深色」 | `html` 为 `data-theme="dark"`；暗色 `--md-sys-color-surface` / `on-surface` 对比可读；弹层遮罩使用 `--color-scrim-*` 等 token，不偏灰死。 |
| **跟随系统** | 选「跟随系统」后，用系统或 DevTools 切换 **prefers-color-scheme** | 明暗随系统切换且无中间态错色；与 `material-theme.css` 中 `:root:not([data-theme='light'])` 暗色块一致。 |
| **浅色 OS + 强制深色** | 系统浅色下仅通过扩展选深色 | 必须走 **`data-theme="dark"`** 整块暗色板，不得仅靠媒体查询「半套」暗色。 |
| **对比度** | 启用系统「提高对比度」或 Chrome 模拟 `prefers-contrast: more` | 主要文本与背景、焦点环、错误/成功状态仍可辨识；高对比分支（如 `main.css`）生效且无布局崩坏。 |
| **回归** | 全局抽查 | 无新增裸 Hex / 游离 `rgb`；语义 success/warning/info 与产品语义一致（warning 已映射 tertiary 等约定见 `semantic-colors.css` 头注释）。 |

#### 2.5.5 官方配色预设（与代码同步）

> **单一事实来源**：`packages/design-tokens/src/color-presets.ts`（导出 `COLOR_PRESET_DEFINITIONS`、`ColorPresetId`、`normalizeColorPresetId` 等）。  
> 下文表格与源码 **必须同步维护**；在 Material Theme Builder 中换种子或增减预设时，**先改 TS 再改本节（及后续接入的 UI 文案）**。

| 代码 `id`（`data-color-preset` / 存储） | 中文名 | 英文名（内部） | 种子 Hex（Builder 主色种子） | 气质 |
|----------------------------------------|--------|----------------|-------------------------------|------|
| `default` | 晴空 | Skyline | `#3B82F6` | 与现有 Logo 蓝一致，默认品牌色 |
| `ocean` | 碧海 | Ocean | `#0E7490` | 偏青绿，冷静、工具感 |
| `forest` | 森雾 | Forest | `#047857` | 偏祖母绿，自然、长时间阅读 |
| `ember` | 琥珀 | Ember | `#C2410C` | 偏暖橙琥珀，偏活力不是错误红 |
| `violet` | 暮紫 | Twilight | `#6D28D9` | 紫，偏「智能/创意」但不荧光 |
| `slate` | 岩灰 | Slate | `#475569` | 冷灰蓝，克制、贴近系统工具栏 |

**文件夹命名**：Material 导出目录为 `Skyline`、`Ocean`、`Forest`、`Ember`、`Twilight`、`Slate`；其中 **`Twilight` 对应代码与 CSS 中的 preset id `violet`**（与 `color-presets.ts` 一致）。

**接入说明（后续开发）**：每套预设对应 Builder 导出的 **light + dark** 两套 `--md-sys-color-*` 赋值，经 `data-color-preset="<id>"` 与现有 `data-theme` 组合选择器挂到 `html`；默认套对应 `presets/default.css`（源目录 `Skyline`），更新流程见 §2.5.2。

**文档路径（单一来源）**：`docs/product/AcuityBookmarks-产品文档-v3.0.md` — 仓库内产品说明、架构与规范均以本文件为准，不另设平行「产品说明」文档。

---

## 第三部分：核心功能

### 3.1 书签管理（Management Page）

#### 3.1.1 双面板对比视图

**页面路径**：`frontend/src/pages/management/Management.vue`

- **左侧面板**：原始书签结构（`SimpleBookmarkTree`）
- **右侧面板**：编辑后结构（`SimpleBookmarkTree`）
- **数据源**：统一从 IndexedDB 加载

```typescript
// Management.vue 关键逻辑
const managementStore = useBookmarkManagementStore()

onMounted(async () => {
  // 初始化：从 IndexedDB 加载数据
  await managementStore.initialize()

  // 监听数据同步事件（通过 mitt 事件总线）
  const unsubscribeDbSynced = onEvent('data:synced', handleDbSynced)

  onUnmounted(() => {
    unsubscribeDbSynced()
  })
})
```

#### 3.1.2 虚拟滚动

**组件路径**：`frontend/src/components/composite/SimpleBookmarkTree/SimpleBookmarkTree.vue`

使用 `@tanstack/vue-virtual` 实现虚拟滚动：

```vue
<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'

const virtualizer = useVirtualizer({
  count: flattenedNodes.value.length,
  getScrollElement: () => scrollContainerRef.value,
  estimateSize: () => 32, // 每个节点高度 32px
  overscan: 10 // 预渲染 10 个节点
})
</script>
```

#### 3.1.3 拖拽重组

支持书签和文件夹的拖拽移动：

- **拖拽库**：原生 HTML5 Drag & Drop API
- **限制**：只能在同一面板内拖拽，不支持跨面板
- **数据更新**：拖拽完成后通过 Application Service 发送消息到 Background Script

### 3.2 智能搜索

#### 3.2.1 搜索架构

**核心文件**：`frontend/src/core/search/unified-search-service.ts`

支持三种搜索模式：

1. **关键词搜索**：基于 IndexedDB 索引的精确匹配
2. **模糊搜索**：基于 Fuse.js 的模糊匹配
3. **语义搜索**：基于 LLM 的语义理解（需要后端支持）

```typescript
// 搜索流程
class UnifiedSearchService {
  async search(query: string, options: SearchOptions) {
    // 1. 从 IndexedDB 获取候选结果
    const candidates = await indexedDBManager.searchBookmarks(query, options)

    // 2. 如果启用模糊搜索，使用 Fuse.js 再次过滤
    if (options.fuzzyMatch) {
      return this.fuseSearch(candidates, query)
    }

    // 3. 返回结果
    return candidates
  }
}
```

#### 3.2.2 搜索性能优化

- **索引优化**：IndexedDB 中为 `titleLower`、`urlLower`、`domain`、`keywords`、`tags` 建立索引
- **结果缓存**：使用 `query-cache.ts` 缓存搜索结果
- **防抖**：使用 VueUse 的 `useDebounceFn` 防抖用户输入

### 3.3 书签特征检测

#### 3.3.1 特征标签系统

**核心文件**：`frontend/src/services/bookmark-trait-service.ts`

支持的特征标签：

- `invalid`：失效书签（HTTP 404/500 或无效 URL）
- `duplicate`：重复 URL
- `internal`：浏览器内部链接（chrome://、file:// 等）

```typescript
// 特征检测流程
async function evaluateBookmarkTraits(bookmarkId: string) {
  const bookmark = await indexedDBManager.getBookmarkById(bookmarkId)
  if (!bookmark?.url) return

  const traitTags: string[] = []

  // 1. 检查是否为浏览器内部协议
  if (isInternalProtocol(bookmark.url)) {
    traitTags.push('internal')
  }
  // 2. 对于非内部协议的书签，进行进一步检查
  else {
    // 2.1 URL格式检测
    if (!isValidBookmarkUrl(bookmark.url)) {
      traitTags.push('invalid')
    }
    // 2.2 HTTP错误检测
    else {
      const crawlMetadata = await indexedDBManager.getCrawlMetadata(bookmarkId)
      if (crawlMetadata && isHttpFailure(crawlMetadata)) {
        traitTags.push('invalid')
      }
    }
  }

  // 3. 重复书签检测
  const duplicates = await indexedDBManager.getBookmarksByUrl(bookmark.url)
  if (duplicates.length > 1) {
    traitTags.push('duplicate')
  }

  // 4. 更新特征标签到 IndexedDB
  await indexedDBManager.updateBookmarksTraits([
    {
      id: bookmarkId,
      traitTags,
      traitMetadata: traitTags.map(tag => ({
        tag,
        detectedAt: Date.now(),
        source: 'worker'
      }))
    }
  ])
}
```

#### 3.3.2 特征数据管理

**核心 Store**: `frontend/src/stores/trait-data-store.ts`

特征数据采用统一的 Store 管理:

- **TraitDataStore**: 单一数据源,管理所有特征统计
- **智能缓存**: 5 分钟缓存,减少查询次数
- **自动更新**: 监听 `acuity-bookmarks-trait-updated` 消息自动刷新
- **请求去重**: 防止并发重复请求
- **自动重试**: 网络/数据库错误自动重试 3 次

**Composable API**: `frontend/src/composables/useTraitData.ts`

提供 7 个响应式 API:
- `useTraitStatistics()` - 获取所有统计
- `useTraitCount(trait)` - 获取单个特征数量
- `useTotalNegativeTraits()` - 获取负面特征总数
- `useHasNegativeTraits()` - 是否有问题
- `useTraitLoading()` - 加载状态
- `useTraitLastUpdated()` - 最后更新时间
- `useRefreshTraits()` - 手动刷新

**使用示例**:
```typescript
// 在组件中使用
import { useTraitCount } from '@/composables/useTraitData'

const invalidCount = useTraitCount('invalid')
// 自动响应式更新,无需手动刷新
```

**架构优势**:
- ✅ 单一数据源,避免数据不一致
- ✅ 自动更新,无需手动刷新
- ✅ 智能缓存,减少查询次数
- ✅ 容错能力强,自动重试失败请求

### 3.4 本地化爬取

#### 3.4.1 爬取架构

**核心文件**：`frontend/src/services/local-bookmark-crawler.ts`

- **爬取方式**：通过 `fetch` API 直接请求书签 URL
- **并发控制**：使用 `p-queue` 限制并发数（默认 5）
- **数据存储**：爬取元数据存储在 IndexedDB 的 `crawl_metadata` 表

```typescript
class LocalBookmarkCrawler {
  private queue = new PQueue({ concurrency: 5 })

  async crawlBookmark(bookmarkId: string, url: string) {
    return this.queue.add(async () => {
      try {
        const response = await fetch(url, { method: 'HEAD' })

        // 存储爬取元数据
        await indexedDBManager.saveCrawlMetadata({
          bookmarkId,
          url,
          httpStatus: response.status,
          lastCrawled: Date.now()
        })
      } catch (error) {
        logger.error('爬取失败', { bookmarkId, url, error })
      }
    })
  }
}
```

---

## 第四部分：开发规范

### 4.1 代码规范

#### 4.1.1 TypeScript 规范

- ✅ **禁止使用 `any`**：所有类型必须明确声明
- ✅ **使用 Zod 进行运行时校验**：对外部数据（IndexedDB、Chrome API）进行校验
- ✅ **JSDoc 注释**：所有公开函数和类必须有中文 JSDoc 注释

```typescript
/**
 * 从 IndexedDB 加载所有书签
 *
 * @returns 书签节点数组
 * @throws {Error} 如果数据库未初始化
 */
async function loadAllBookmarks(): Promise<BookmarkNode[]> {
  const records = await indexedDBManager.getAllBookmarks()
  return BookmarkRecordArraySchema.parse(records)
}
```

#### 4.1.2 Vue 组件规范

- ✅ **使用 `<script setup>` + Composition API**
- ✅ **组件命名使用 PascalCase**：`SimpleBookmarkTree.vue`
- ✅ **导出组件名**：`defineOptions({ name: "SimpleBookmarkTree" })`

```vue
<script setup lang="ts">
import { defineOptions } from 'vue'

defineOptions({
  name: 'SimpleBookmarkTree'
})

// 组件逻辑
</script>
```

#### 4.1.2.1 Hover 与指针交互（实现约束）{#4121-hover-与指针交互实现约束}

产品层完整约定见 [§1.1.1 Hover 与指针交互](#interaction-hover)。开发时须遵守：

- 列表行（书签树、搜索建议、筛选标签、上下文菜单项等）的 `:hover`：**仅**表面属性（背景、边框、`box-shadow`、`outline`、Material **state layer** token），**禁止** `translateY` / 行级 `scale`。
- `transition` 枚举具体属性；避免在列表行上使用 `transition: all` 顺带动画 `transform`。
- 浮层入场/离场、成功/错误反馈动画与「列表 hover」分离，不得复用列表行的位移缩放习惯。

#### 4.1.3 Pinia Store 规范

- ✅ **使用 Composition API 风格**：`const store = defineStore('name', () => { ... })`
- ✅ **使用 Immer 更新复杂状态**：`updateMap(nodes.value, draft => { ... })`
- ✅ **明确导出 API**：在 `return` 中明确导出哪些状态和方法

```typescript
export const useBookmarkStore = defineStore('bookmarks', () => {
  const nodes = ref<Map<string, BookmarkNode>>(new Map())

  function addNode(node: BookmarkNode) {
    updateMap(nodes.value, draft => {
      draft.set(node.id, node)
    })
  }

  return {
    // State
    nodes: readonly(nodes),
    // Actions
    addNode
  }
})
```

### 4.2 文件组织规范

#### 4.2.1 组件目录结构

```
components/
├── base/              # 基础组件（Button, Input, Dialog）
│   ├── Button/
│   │   ├── Button.vue
│   │   ├── Button.d.ts       # TypeScript 类型定义
│   │   └── Button.README.md  # 组件文档
│   └── ...
└── composite/         # 复合组件（业务组件）
    ├── SimpleBookmarkTree/
    └── ...
```

#### 4.2.2 类型定义文件

所有类型定义集中在 `frontend/src/types/` 目录：

```
types/
├── domain/            # 领域模型类型
│   ├── bookmark.ts
│   └── search.ts
├── application/       # 应用层类型
├── infrastructure/    # 基础设施层类型
└── index.ts           # 统一导出
```

### 4.3 Git 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```bash
# 格式
<type>(<scope>): <subject>

# 示例
feat(search): 添加语义搜索功能
fix(store): 修复书签树无限递归问题
refactor(indexeddb): 使用 Immer 简化状态更新
docs(readme): 更新安装说明
```

**Type 类型**：

- `feat`：新功能
- `fix`：Bug 修复
- `refactor`：代码重构
- `docs`：文档更新
- `style`：代码格式调整
- `test`：测试相关
- `chore`：构建/工具链相关

---

## 第五部分：数据流设计

### 5.1 单向数据流详解

#### 5.1.1 完整数据流图

```
[用户操作 UI]
      ↓
[Vue Component]
      ↓
[Application Service] ────发送消息───→ [Background Script]
                                              ↓
                                      [调用 Chrome API]
                                              ↓
                                      [Chrome Bookmarks]
                                              ↓
                                  [触发 chrome.bookmarks.on* 事件]
                                              ↓
                                  [Background Script 监听器]
                                              ↓
                              [同步到 IndexedDB（全量/增量）]
                                              ↓
                              [广播消息到所有前端页面]
                                              ↓
                                  [前端监听 mitt 事件]
                                              ↓
                              [从 IndexedDB 刷新数据]
                                              ↓
                                  [更新 Pinia Store]
                                              ↓
                                  [Vue 响应式更新 UI]
```

#### 5.1.2 CRUD 操作流程

##### 创建书签

```typescript
// 1. 前端发起请求
async function createBookmark(parentId: string, title: string, url: string) {
  await chrome.runtime.sendMessage({
    type: 'CREATE_BOOKMARK',
    parentId,
    title,
    url
  })
}

// 2. Background Script 处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CREATE_BOOKMARK') {
    chrome.bookmarks.create({
      parentId: message.parentId,
      title: message.title,
      url: message.url
    })
    // 注意：不需要手动同步，chrome.bookmarks.onCreated 会自动触发
  }
})

// 3. chrome.bookmarks.onCreated 自动触发同步
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  await bookmarkSyncService.syncIncremental('created', id)
  chrome.runtime.sendMessage({
    type: 'acuity-bookmarks-db-synced',
    eventType: 'created',
    bookmarkId: id
  })
})

// 4. 前端监听同步消息
onEvent('data:synced', async data => {
  if (data.eventType === 'created') {
    await bookmarkStore.loadFromIndexedDB()
  }
})
```

##### 更新书签

```typescript
// 前端 → Background → Chrome API → onChanged → 同步 → 前端刷新
```

##### 删除书签

```typescript
// 前端 → Background → Chrome API → onRemoved → 同步 → 前端刷新
```

#### 5.1.3 增量同步 vs 全量同步

| 同步方式     | 触发时机                         | 性能                 | 数据完整性                |
| ------------ | -------------------------------- | -------------------- | ------------------------- |
| **增量同步** | 单个书签的 CRUD 操作             | 高（只更新单个节点） | 中（依赖 pathIds 正确性） |
| **全量同步** | 书签导入、移动操作、数据健康检查 | 低（重建整个树）     | 高（完全一致）            |

```typescript
// 增量同步
await bookmarkSyncService.syncIncremental('created', bookmarkId)

// 全量同步
await bookmarkSyncService.syncAllBookmarks()
```

### 5.2 事件系统（mitt）

#### 5.2.1 事件定义

**文件路径**：`frontend/src/infrastructure/events/event-bus.ts`

```typescript
export interface AppEvents {
  'bookmark:created': { id: string; bookmark: BookmarkNode }
  'bookmark:updated': { id: string; changes: Partial<BookmarkNode> }
  'bookmark:deleted': { id: string }
  'data:synced': { eventType: string; bookmarkId: string; timestamp: number }
  'sync:started': { source: 'background' | 'user' | 'auto' }
  'sync:completed': { duration: number; count: number }
}
```

#### 5.2.2 事件使用

```typescript
// 发送事件
emitEvent('bookmark:created', { id: '123', bookmark: { ... } })

// 监听事件
const unsubscribe = onEvent('bookmark:created', (data) => {
  console.log('书签创建:', data.id)
})

// 取消监听
unsubscribe()
```

### 5.3 Chrome 消息桥接

**文件路径**：`frontend/src/infrastructure/events/chrome-message-bridge.ts`

负责将 Chrome Runtime 消息转换为 mitt 事件：

```typescript
export function initializeChromeMessageBridge() {
  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'acuity-bookmarks-db-synced') {
      // 将 Chrome 消息转换为 mitt 事件
      emitEvent('data:synced', {
        eventType: message.eventType,
        bookmarkId: message.bookmarkId,
        timestamp: message.timestamp
      })
    }
  })
}
```

---

## 第六部分：存储方案

### 6.1 存储层级划分

AcuityBookmarks 使用 **四层存储架构**，每层有明确的职责：

| 存储类型                   | 生命周期                   | 容量限制           | 使用场景                                    | Chrome 版本要求 |
| -------------------------- | -------------------------- | ------------------ | ------------------------------------------- | --------------- |
| **IndexedDB**              | 永久（除非用户清除）       | 可用磁盘空间的 60% | 大量书签数据（2 万+）、爬取元数据、搜索历史 | 所有版本        |
| **chrome.storage.local**   | 永久                       | 10 MB              | 用户偏好设置、扩展配置、持久化状态          | 所有版本        |
| **chrome.storage.session** | 会话级（浏览器关闭后清除） | 10 MB              | 临时数据、UI 状态、未保存表单、搜索历史     | Chrome 102+     |
| **Pinia Store**            | 页面级（页面刷新后清除）   | 内存               | 高频 UI 状态、计算属性、临时缓存            | N/A             |

### 6.2 IndexedDB 设计

#### 6.2.1 数据库结构

**数据库名称**：`AcuityBookmarksDB`  
**版本号**：`11`

**对象存储（Object Stores）**：

```typescript
{
  // 1. 书签数据表（主表）
  bookmarks: {
    keyPath: 'id',
    indexes: [
      'parentId',           // 父节点 ID
      'url',                // URL
      'urlLower',           // URL（小写）
      'domain',             // 域名
      'titleLower',         // 标题（小写）
      'parentId_index',     // 复合索引（父节点 + 排序）
      'pathIds',            // 路径 ID 数组（multiEntry）
      'keywords',           // 关键词（multiEntry）
      'tags',               // 标签（multiEntry）
      'traitTags',          // 特征标签（multiEntry）
      'dateAdded'           // 添加时间
    ]
  },

  // 2. 全局统计表
  global_stats: {
    keyPath: 'key',
    indexes: ['key', 'updatedAt']
  },

  // 3. 设置表
  settings: {
    keyPath: 'key',
    indexes: ['updatedAt', 'type']
  },

  // 4. 搜索历史表
  search_history: {
    keyPath: 'id',
    autoIncrement: true,
    indexes: ['query', 'timestamp', 'source']
  },

  // 5. Favicon 缓存表
  favicon_cache: {
    keyPath: 'domain',
    indexes: ['timestamp', 'lastAccessed', 'bookmarkCount']
  },

  // 6. 爬取元数据表
  crawl_metadata: {
    keyPath: 'bookmarkId',
    indexes: ['domain', 'httpStatus', 'lastCrawled']
  },

  // 7. 向量嵌入表（AI 功能）
  embeddings: {
    keyPath: 'bookmarkId',
    indexes: ['domain', 'updatedAt']
  },

  // 8. AI 任务表
  ai_jobs: {
    keyPath: 'id',
    indexes: ['status', 'type', 'createdAt']
  }
}
```

#### 6.2.2 BookmarkRecord 数据结构

```typescript
interface BookmarkRecord {
  // 基础字段（来自 Chrome API）
  id: string
  title: string
  url?: string
  parentId?: string
  index?: number
  dateAdded?: number
  dateGroupModified?: number

  // 增强字段（自定义）
  titleLower: string // 标题小写（用于搜索）
  urlLower?: string // URL 小写（用于搜索）
  domain?: string // 域名（提取自 URL）
  pathIds: string[] // 路径 ID 数组（从根到当前节点）
  keywords: string[] // 关键词（提取自标题和 URL）
  tags: string[] // 用户自定义标签

  // 特征相关
  traitTags: string[] // 特征标签（duplicate, invalid, internal）
  traitMetadata: Array<{
    tag: string
    detectedAt: number
    source: 'worker' | 'manual'
    notes?: string
  }>

  // 统计信息
  visitCount?: number // 访问次数
  lastVisited?: number // 最后访问时间
}
```

#### 6.2.3 IndexedDB 性能优化

**针对 2 万书签的优化**：

1. **批量操作**：使用 `runBatchOperation` 分批写入（默认 2000/批）
2. **索引优化**：为常用查询字段建立索引
3. **缓存树结构**：`bookmarkStore` 中缓存计算好的树结构
4. **递归扁平化**：使用 `flattenTreeToMap` 将树结构扁平化为 Map

```typescript
// 性能对比（2 万书签）
操作                 | 优化前   | 优化后   | 提升
---------------------|---------|---------|------
初次加载             | 5-8s    | 1-2s    | 4-5x
树结构计算           | 800ms   | <50ms   | 16x
节点查找（Map）      | O(n)    | O(1)    | 2万x
```

### 6.3 chrome.storage 使用

#### 6.3.1 chrome.storage.session（临时数据）

**文件路径**：`frontend/src/infrastructure/storage/modern-storage.ts`

```typescript
// 1. 数据库就绪状态（会话级）
await modernStorage.setSession('AB_DB_READY', true)

// 2. 同步状态（防止重复同步）
await modernStorage.setSession('SYNC_STATE', { isSyncing: true })

// 3. 爬取任务状态
await modernStorage.setSession('CRAWL_RUNNING', true)

// 4. UI 状态（展开的文件夹）
await modernStorage.setSession('ORIGINAL_EXPANDED', new Set(['1', '2']))

// 5. 搜索历史（会话级）
await modernStorage.setSession('SEARCH_HISTORY', ['query1', 'query2'])

// 6. 未保存的编辑草稿
await modernStorage.setSession('EDIT_BOOKMARK_DRAFT', {
  id: '123',
  title: '新标题'
})
```

#### 6.3.2 chrome.storage.local（持久化数据）

```typescript
// 1. 用户偏好设置
await modernStorage.setLocal('USER_PREFERENCES', {
  theme: 'dark',
  language: 'zh-CN'
})

// 2. 扩展配置
await modernStorage.setLocal('EXTENSION_CONFIG', {
  apiEndpoint: 'https://api.acuitybookmarks.com',
  enableAI: true
})

// 3. 搜索设置
await modernStorage.setLocal('SEARCH_SETTINGS', {
  fuzzyMatch: true,
  maxResults: 100
})

// 4. 清理过滤器（持久化）
await modernStorage.setLocal('ACTIVE_FILTERS', ['DEAD_LINK'])
```

### 6.4 Pinia Store（内存状态）

**适用场景**：

- ✅ 高频更新的 UI 状态（选中项、悬停状态）
- ✅ 计算属性（虚拟滚动的扁平化节点列表）
- ✅ 临时缓存（避免重复计算）

```typescript
// 示例：bookmarkStore
export const useBookmarkStore = defineStore('bookmarks', () => {
  // 内存中的节点映射（从 IndexedDB 加载后缓存）
  const nodes = ref<Map<string, BookmarkNode>>(new Map())

  // 计算属性（自动响应式）
  const bookmarkTree = computed(() => buildTreeFromNodes(nodes.value))

  return { nodes, bookmarkTree }
})
```

---

## 第七部分：关键实现细节

### 7.1 Immer 集成

**文件路径**：`frontend/src/infrastructure/state/immer-helpers.ts`

Immer 用于简化不可变状态更新：

```typescript
import { produce } from 'immer'

/**
 * 更新 Vue Ref 包装的 Map
 */
export function updateMap<K, V>(
  mapRef: Ref<Map<K, V>>,
  updater: (draft: Map<K, V>) => void
): void {
  mapRef.value = produce(mapRef.value, updater)
}

/**
 * 更新 Vue Ref 包装的数组
 */
export function updateArray<T>(
  arrayRef: Ref<T[]>,
  updater: (draft: T[]) => void
): void {
  arrayRef.value = produce(arrayRef.value, updater)
}

// 使用示例
const nodes = ref(new Map<string, BookmarkNode>())

updateMap(nodes, draft => {
  draft.set('123', { id: '123', title: '新书签' })
  draft.delete('456')
})
```

### 7.2 TanStack Query 集成

**文件路径**：`frontend/src/infrastructure/query/query-client.ts`

TanStack Query 用于管理异步数据获取和缓存：

```typescript
import { QueryClient } from '@tanstack/vue-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 分钟缓存
      cacheTime: 10 * 60 * 1000, // 10 分钟后清除
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})
```

**Composable 使用**：

```typescript
// frontend/src/composables/useBookmarkQueries.ts
import { useQuery } from '@tanstack/vue-query'

export function useBookmarkQuery(bookmarkId: string) {
  return useQuery({
    queryKey: ['bookmark', bookmarkId],
    queryFn: async () => {
      return await indexedDBManager.getBookmarkById(bookmarkId)
    },
    staleTime: 5 * 60 * 1000
  })
}
```

### 7.3 VueUse 实用工具

**常用 VueUse Composables**：

```typescript
import {
  useEventListener, // 自动清理的事件监听
  useDebounceFn, // 防抖函数
  useTimeoutFn, // 自动清理的 setTimeout
  useStorage, // localStorage 响应式包装
  useToggle, // 布尔值切换
  useMouse, // 鼠标位置跟踪
  useIntersectionObserver // 元素可见性检测
} from '@vueuse/core'

// 示例：防抖搜索
const debouncedSearch = useDebounceFn(async (query: string) => {
  await searchService.search(query)
}, 300)
```

### 7.4 Zod 数据校验

**文件路径**：`frontend/src/infrastructure/indexeddb/validation/records.ts`

所有从 IndexedDB 读取的数据都需要通过 Zod 校验：

```typescript
import { z } from 'zod'

export const BookmarkRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url().optional(),
  parentId: z.string().optional(),
  index: z.number().optional(),
  titleLower: z.string(),
  pathIds: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  traitTags: z.array(z.string()).default([]),
  traitMetadata: z
    .array(
      z.object({
        tag: z.string(),
        detectedAt: z.number(),
        source: z.enum(['worker', 'manual']),
        notes: z.string().optional()
      })
    )
    .default([])
})

// 使用
const records = await indexedDBManager.getAllBookmarks()
const validated = BookmarkRecordArraySchema.parse(records)
```

### 7.5 性能监控

**文件路径**：`frontend/src/components/base/PerformanceMonitor/PerformanceMonitor.vue`

开发模式下自动监控性能指标：

```typescript
// 监控指标
interface PerformanceMetrics {
  // 页面加载
  domContentLoaded: number
  windowLoad: number

  // 渲染性能
  firstPaint: number
  firstContentfulPaint: number
  largestContentfulPaint: number

  // 交互性能
  firstInputDelay: number
  totalBlockingTime: number

  // 自定义指标
  bookmarkTreeBuildTime: number
  indexedDBQueryTime: number
}
```

### 7.6 长耗时任务设计原则

> 🎯 **设计哲学**：真实进度 > 假进度 > 无反馈

#### 7.6.1 核心设计原则

##### 原则 1：业务优先级决定执行策略

```typescript
🔴 核心业务（同步执行 + 真实进度）
  - 用户必须等待才能继续操作
  - 阻塞主线程，但提供清晰的进度反馈
  - 告诉用户："在做什么"、"进度多少"、"还要多久"

🟡 辅助业务（Worker 异步 + 后台执行）
  - 不影响核心书签操作
  - 可以在后台慢慢执行
  - 失败不影响主要功能
```

##### 原则 2：真实进度反馈优于假装流畅

```typescript
✅ 真实进度：50% → 用户知道还要等多久 → 用户体验好
⚠️ 假进度：转圈圈 → 用户焦虑但能接受 → 用户体验一般
❌ 无反馈：页面冻结 → 用户以为崩溃了 → 用户体验差
```

**理由**：

- 如果数据没有完全录入 IndexedDB，用户打开管理页面也做不了什么
- Worker 异步只是"假装流畅"，实际可操作时间不变
- 诚实的进度反馈 > 美好的假象

#### 7.6.2 业务分级与执行策略

##### 🔴 核心业务（必须同步执行 + 实时进度）

| 业务               | 耗时               | 优先级 | 执行策略        | 进度要求                 |
| ------------------ | ------------------ | ------ | --------------- | ------------------------ |
| 书签全量同步       | 1-2s (20,000 书签) | P0     | 同步 + 分批写入 | 阶段 + 百分比 + 预计时间 |
| 书签导入           | 2-5s (批量导入)    | P0     | 同步 + 分批写入 | 导入进度 + 剩余时间      |
| 初次数据加载       | 1-2s               | P0     | 同步            | 加载阶段 + 百分比        |
| 书签移动（优化后） | 50-100ms           | P0     | 同步            | 无需进度（瞬间完成）     |

**实现要求**：

```typescript
// 1. 进度数据结构
interface SyncProgress {
  phase: 'fetching' | 'converting' | 'writing' | 'indexing' | 'completed'
  current: number
  total: number
  percentage: number
  message: string
  estimatedRemaining?: number  // 预计剩余时间（ms）
}

// 2. 进度回调机制
type ProgressCallback = (progress: SyncProgress) => void

class BookmarkSyncService {
  private progressCallbacks: Set<ProgressCallback> = new Set()

  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback)
    return () => this.progressCallbacks.delete(callback)
  }

  private notifyProgress(progress: SyncProgress): void {
    this.progressCallbacks.forEach(cb => cb(progress))
  }
}

// 3. UI 组件要求
<SyncProgressDialog
  :show="syncProgress.show"
  :progress="syncProgress.data"
>
  <!-- 必须显示：-->
  <!-- - 当前阶段（fetching/converting/writing）-->
  <!-- - 进度百分比（43%）-->
  <!-- - 当前/总数（8,523 / 20,000）-->
  <!-- - 预计剩余时间（约 3 秒）-->
</SyncProgressDialog>
```

##### 🟡 辅助业务（Worker 异步 + 队列调度）

| 业务               | 耗时            | 优先级 | 执行策略          | 调度要求              |
| ------------------ | --------------- | ------ | ----------------- | --------------------- |
| 网页爬虫（元数据） | 按需，单个 2-5s | P1     | Worker + 队列     | 优先级排序 + 并发控制 |
| AI 标签分类        | 按需，单个 1-3s | P1     | Worker + 批处理   | 后台执行 + 可暂停     |
| 健康扫描           | 5-10s           | P2     | Worker + 后台执行 | 可取消 + 进度显示     |
| 全文搜索索引       | 3-5s            | P1     | Worker + 增量构建 | 后台构建              |

**实现要求**：

```typescript
// Worker 任务调度器
class WorkerTaskScheduler {
  private queue: WorkerTask[] = []
  private running = new Set<string>()
  private maxConcurrent = 2 // 同时最多 2 个任务

  enqueue(task: WorkerTask, onProgress?: ProgressCallback): void {
    this.queue.push(task)
    this.queue.sort((a, b) => b.priority - a.priority) // 优先级排序
    this.processNext()
  }

  pause(): void {
    this.paused = true
    this.worker?.postMessage({ type: 'pause' })
  }

  resume(): void {
    this.paused = false
    this.processNext()
  }

  cancel(taskId: string): void {
    this.queue = this.queue.filter(t => t.id !== taskId)
    if (this.running.has(taskId)) {
      this.worker?.postMessage({ type: 'cancel', taskId })
    }
  }
}
```

#### 7.6.3 进度条实现指南

##### UI 组件结构

```vue
<template>
  <Dialog persistent :hide-close="true">
    <!-- 1. 阶段指示器 -->
    <div class="phase-indicators">
      <div
        v-for="phase in phases"
        :class="{ active: isActive(phase), completed: isCompleted(phase) }"
      >
        <Icon :name="phase.icon" />
        <span>{{ phase.label }}</span>
      </div>
    </div>

    <!-- 2. 进度条 -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: `${percentage}%` }" />
    </div>

    <!-- 3. 详细信息 -->
    <div class="progress-details">
      <div class="progress-text">{{ message }}</div>
      <div class="progress-stats">
        <span class="percentage">{{ Math.round(percentage) }}%</span>
        <span class="count">{{ current }} / {{ total }}</span>
        <span class="time">剩余约 {{ formatTime(estimatedRemaining) }}</span>
      </div>
    </div>
  </Dialog>
</template>
```

##### 性能要求

- **初次加载**：< 2s
- **全量同步**：< 2s（20,000 书签）
- **单书签操作**：< 50ms（增量更新）
- **进度更新频率**：每 100 个节点报告一次
- **UI 响应性**：每批次后 `setTimeout(0)` 让出主线程

#### 7.6.4 架构决策理由

##### 为什么核心业务不用 Worker？

```typescript
问题：如果 IndexedDB 没有完整数据
  ↓
Management 页面无法展示书签树
  ↓
用户无法进行任何有意义的操作
  ↓
Worker 异步带来的"UI 流畅度"毫无价值
```

**结论**：

- ✅ 数据完整性 > UI 响应性
- ✅ 真实进度反馈 > 假装不阻塞
- ✅ 分批写入 + `setTimeout(0)` = 既有进度又不"冻结"

##### 为什么辅助业务用 Worker？

```typescript
场景：用户正在 Management 页面编辑书签
  ↓
后台触发健康扫描（5-10s）
  ↓
【不用 Worker】主线程阻塞 → 页面冻结 → 用户无法操作
【使用 Worker】主线程不阻塞 → 可以继续编辑 → 后台慢慢扫描
```

**结论**：

- ✅ 不影响核心操作是关键
- ✅ 失败也不影响主要功能
- ✅ 可以提供"取消"、"暂停"选项

#### 7.6.5 当前实现状态

##### ✅ 已符合原则

- 爬虫系统使用 Offscreen Document（不阻塞主线程）
- Management 页面有 loading 状态（`isPageLoading`）
- 健康扫描有独立 loading 状态（`isCleanupLoading`）
- 书签同步采用增量 + 全量混合策略

##### ❌ 需要改进

1. **书签全量同步缺少真实进度**
   - 当前：只有转圈圈
   - 期望：阶段指示（读取 → 转换 → 写入）+ 百分比（43%）+ 预计时间（约 3 秒）

2. **特征检测支持 Worker 异步执行**
   - 当前：`bookmark-trait-service.ts` 提供同步和异步两种模式
   - 已实现：`trait-detection-service.ts` 提供 Worker 异步检测，支持进度反馈和取消操作

3. **缺少进度组件**
   - 当前：静态 Loading 文本
   - 期望：通用的 `SyncProgressDialog` 组件，复用于所有长耗时任务

### 7.7 书签筛选与混合检索（实现口径）

> 对外 UI 与交互文案统一称 **「筛选」**；本节描述技术实现。

- **意图路由**：`frontend/src/core/query-engine/intent-detector.ts` 根据查询长度、技术词 / 语义关键词集合等选择 `fuse` / `semantic` / `hybrid` / `auto`；短查询阈值 **`MIN_SEMANTIC_LENGTH = 2`**（支持「代码」等双字词走语义倾向）。
- **本地模糊层**：`FlexSearchStrategy`（`query-service.ts` 中仍以 `searchWithFuse` 等历史命名调用）负责标题 / URL / 域名 / 关键词的快速命中。
- **语义层**：在已开通 PRO 或已配置用户 Key 等前提下，由语义检索补充概念相近结果。
- **Hybrid 超时**：`QueryService.searchWithHybrid` 中语义分支与 **600ms** 超时竞速，超时则降级为**仅本地模糊**结果，避免 UI 长时间等待。

### 7.8 跨页面同步与扩展内通信

- **推荐机制**：Popup、Side Panel、Management、Background 等多进程场景，以 **`chrome.storage.*` + `chrome.storage.onChanged`** 做状态广播；**不要**将 `BroadcastChannel` 作为主同步路径（扩展内上下文隔离，可靠性差、难测）。
- **收藏夹 UI 同步**：`frontend/src/composables/useCrossPageSync.ts` 的 `initCrossPageSync()` 已在 **Popup、Side Panel、Management** 各入口 `main.ts` 调用；会话域约定键 **`__favoriteEvent`**（`chrome.storage.session`）用于收藏相关增量信号。
- **主题与配色等偏好**：经 `chrome.storage.local` / `sync`（如 `theme`、`colorPreset`）写入并由 `onChanged` 驱动各 UI 刷新（与 `useThemeSync`、设置页配色节一致）；**Popup / Side Panel / Management / Settings** 已挂载 `useThemeSync`；**Onboarding** 等入口是否接入以各页 `main.ts` 为准（当前可与上述四页表现不一致，属产品可选范围）。
- **手工回归建议**：并行打开 Popup、Side Panel、Management，在任一页切换浅色/深色或配色预设，其余页应通过 `onChanged` 立即一致。

---

## 第八部分：测试与质量保障

### 8.1 测试策略

#### 8.1.1 单元测试

**框架**：Vitest + @testing-library/vue

```typescript
// 示例：测试 Immer 工具函数
import { describe, it, expect } from 'vitest'
import { updateMap } from '@/infrastructure/state/immer-helpers'

describe('updateMap', () => {
  it('should update map immutably', () => {
    const mapRef = ref(new Map([['a', 1]]))
    const oldMap = mapRef.value

    updateMap(mapRef, draft => {
      draft.set('b', 2)
    })

    expect(mapRef.value).not.toBe(oldMap) // 不可变
    expect(mapRef.value.get('b')).toBe(2) // 更新成功
  })
})
```

#### 8.1.2 组件测试

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import Button from '@/components/base/Button/Button.vue'

describe('Button', () => {
  it('should emit click event', async () => {
    const wrapper = mount(Button, {
      props: { label: 'Click me' }
    })

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })
})
```

#### 8.1.3 E2E 测试

**工具**：Puppeteer

```bash
# 运行 E2E 测试
bun run e2e:management --ext $EXT_ID
```

#### 8.1.4 Service Worker 与消息边界测试

| 类型 | 命令 | 说明 |
|------|------|------|
| **单元** | `bun run test:service-worker` | `frontend/src/tests/service-worker/lifecycle.test.ts`，覆盖 MV3 生命周期与 `onMessage` 异步边界（异步处理须 **`return true`** 以保持消息通道；**单次** `sendResponse` 等）。 |
| **E2E** | `bun run test:service-worker:e2e` | 独立 Vitest 配置（`vitest.e2e.config.ts`），依赖已安装的 Puppeteer；偏慢，CI 可择机启用。 |
| **实现约束** | MV3 | Service Worker 可能随时休眠；**持久状态**须落在 `chrome.storage.*` / `chrome.alarms` 等，禁止依赖进程内全局变量充当跨唤醒「单例」。 |

#### 8.1.5 测试分层原则

- **默认**：以 Vitest 单元 / 组件测试为主，保证快速反馈。
- **补充**：管理页 E2E（`bun run e2e:management`）、上文 Service Worker 脚本覆盖关键链路与休眠边界。
- **参考**：Chrome 官方扩展测试指引：<https://developer.chrome.com/docs/extensions/how-to/test/>

### 8.2 代码质量工具

#### 8.2.1 ESLint

```bash
# 检查代码
bun run lint:check

# 自动修复
bun run lint:fix:enhanced
```

#### 8.2.2 Stylelint

```bash
# 检查 CSS
bun run stylelint

# 自动修复
bun run stylelint:fix:enhanced
```

#### 8.2.3 TypeScript

```bash
# 类型检查
bun run typecheck:force
```

#### 8.2.4 Prettier

```bash
# 格式化代码
bun run format
```

### 8.3 性能审计

#### 8.3.1 Lighthouse CI

```bash
# 运行 Lighthouse 审计
bun run audit:lhci

# 查看审计报告
bun run audit:lhci:summary
```

### 8.4 Git Hooks

使用 Husky 在提交前自动检查：

```bash
# .husky/pre-commit
bun run lint:fix:enhanced
bun run typecheck:force
```

---

## 附录 A：常用命令速查表

```bash
# ========== 开发 ==========
bun install                     # 安装依赖
bun run dev:frontend            # 前端开发服务器
bun run build:hot               # 前端热构建（推荐）
bun run build:hot:no-lint       # 跳过 ESLint 的热构建

# ========== 构建 ==========
bun run build:frontend          # 前端构建（开发模式）
bun run build:frontend:fast     # 前端构建（生产模式）
bun run build:frontend:analyze  # 分析构建体积

# ========== 代码质量 ==========
bun run typecheck:force         # 类型检查（强制）
bun run lint:fix:enhanced       # ESLint 自动修复
bun run stylelint:fix:enhanced  # Stylelint 自动修复
bun run format                  # Prettier 格式化

# ========== 测试 ==========
bun run test                    # 运行所有测试
bun run test:coverage           # 生成覆盖率报告
bun run e2e:management          # E2E 测试

# ========== 审计 ==========
bun run audit:lhci              # Lighthouse 审计
bun run audit:lhci:summary      # 审计报告摘要
```

---

## 附录 B：关键文件路径速查表

| 功能             | 文件路径                                                |
| ---------------- | ------------------------------------------------------- |
| **架构文档**     |                                                         |
| 单向数据流说明   | `/单向数据流架构说明.md`                                |
| **前端核心**     |                                                         |
| 书签 Store       | `frontend/src/stores/bookmarkStore.ts`                  |
| 管理页面         | `frontend/src/pages/management/Management.vue`          |
| 书签树组件       | `frontend/src/components/composite/SimpleBookmarkTree/` |
| **基础设施**     |                                                         |
| IndexedDB 管理器 | `frontend/src/infrastructure/indexeddb/manager.ts`      |
| 存储抽象层       | `frontend/src/infrastructure/storage/modern-storage.ts` |
| 事件总线         | `frontend/src/infrastructure/events/event-bus.ts`       |
| Immer 工具       | `frontend/src/infrastructure/state/immer-helpers.ts`    |
| **后台脚本**     |                                                         |
| 书签监听         | `frontend/src/background/bookmarks.ts`                  |
| 消息处理         | `frontend/src/background/messaging.ts`                  |
| 爬虫管理器       | `frontend/src/background/crawler-manager.ts`            |
| **服务层**       |                                                         |
| 书签同步服务     | `frontend/src/services/bookmark-sync-service.ts`        |
| 书签特征服务     | `frontend/src/services/bookmark-trait-service.ts`       |
| 特征检测服务     | `frontend/src/services/trait-detection-service.ts`      |
| 本地爬取服务     | `frontend/src/services/local-bookmark-crawler.ts`       |
| **配置文件**     |                                                         |
| Manifest         | `frontend/public/manifest.json`                         |
| Vite 配置        | `frontend/vite.config.ts`                               |
| TypeScript 配置  | `frontend/tsconfig.json`                                |
| ESLint 配置      | `eslint.config.js`                                      |
| Stylelint 配置   | `frontend/stylelint.config.js`                          |

---

## 附录 C：术语表

| 术语               | 解释                                                    |
| ------------------ | ------------------------------------------------------- |
| **DDD**            | Domain-Driven Design（领域驱动设计）                    |
| **单向数据流**     | Chrome API → Background → IndexedDB → UI 的单向数据流动 |
| **IndexedDB**      | 浏览器端的 NoSQL 数据库，本项目的唯一数据源             |
| **BookmarkRecord** | IndexedDB 中存储的书签数据结构                          |
| **BookmarkNode**   | 前端 Vue 组件使用的书签节点数据结构                     |
| **Pinia Store**    | Vue 的状态管理库                                        |
| **mitt**           | 轻量级事件总线库                                        |
| **Immer**          | 不可变状态更新库                                        |
| **TanStack Query** | 异步状态管理和缓存库                                    |
| **VueUse**         | Vue Composition API 实用工具集                          |
| **Zod**            | TypeScript 运行时数据校验库                             |
| **虚拟滚动**       | 只渲染可见区域的节点，提升大列表性能                    |
| **pathIds**        | 从根节点到当前节点的所有父节点 ID 数组                  |
| **traitTags**      | 书签特征标签（duplicate, invalid, internal）            |

---

## 附录 D：FAQ

### Q1: 为什么 IndexedDB 是唯一数据源？

**A**: 为了确保数据一致性和架构清晰性。Chrome API 只负责数据的持久化，IndexedDB 作为中间层提供：

- ✅ 更快的查询性能（索引支持）
- ✅ 离线能力
- ✅ 统一的数据访问接口
- ✅ 防止多个页面同时读取 Chrome API 导致的数据不一致

### Q2: 为什么使用 Immer？

**A**: Immer 简化了复杂数据结构的不可变更新，特别是 `Map` 和嵌套对象：

```typescript
// 不使用 Immer（繁琐）
const newNodes = new Map(nodes.value)
newNodes.set('123', { ...newNodes.get('123'), title: '新标题' })
nodes.value = newNodes

// 使用 Immer（简洁）
updateMap(nodes, draft => {
  draft.get('123')!.title = '新标题'
})
```

### Q3: 什么时候使用 TanStack Query？

**A**: TanStack Query 适用于：

- ✅ 需要缓存的异步数据（如单个书签详情）
- ✅ 需要自动重试的请求
- ✅ 需要乐观更新的场景

不适用于：

- ❌ 全局状态（使用 Pinia）
- ❌ 大量数据的批量读取（直接使用 IndexedDB）

### Q4: chrome.storage.session 和 Pinia Store 有什么区别？

**A**:

| 特性           | chrome.storage.session           | Pinia Store              |
| -------------- | -------------------------------- | ------------------------ |
| **生命周期**   | 浏览器会话级（关闭浏览器后清除） | 页面级（刷新页面后清除） |
| **跨页面共享** | ✅ 是（所有扩展页面共享）        | ❌ 否（每个页面独立）    |
| **性能**       | 中（需要异步读写）               | 高（内存读写）           |
| **适用场景**   | 临时数据、需要跨页面共享的状态   | 高频 UI 状态、计算属性   |

### Q5: 如何确保代码符合项目规范？

**A**: 在每次提交前执行：

```bash
bun run lint:fix:enhanced  # ESLint 自动修复
bun run typecheck:force    # TypeScript 检查
bun run stylelint:fix      # 样式检查
```

或者依赖 Git Hooks 自动执行（已配置 Husky）。

---

## 结语

这份文档涵盖了 AcuityBookmarks 项目的所有关键信息，旨在帮助 AI 编程助手（Cursor/Copilot）：

1. ✅ **理解架构**：DDD 分层、单向数据流、存储方案
2. ✅ **遵循规范**：TypeScript、Vue、Pinia、命名规范
3. ✅ **掌握技术栈**：Vue 3, Pinia, TanStack Query, Immer, mitt, VueUse
4. ✅ **生成高质量代码**：符合项目风格、架构清晰、性能优化

**重要提示**：

- 🚨 禁止直接访问 Chrome API（除 Background Script 外）
- 🚨 禁止使用 `any` 类型
- 🚨 所有外部数据必须通过 Zod 校验
- 🚨 复杂状态更新使用 Immer
- 🚨 新增代码必须添加中文 JSDoc 注释

---

**文档维护者**：AcuityBookmarks 开发团队  
**联系方式**：通过 GitHub Issues 反馈问题  
**最后更新**：2026-04-24

---

© 2025 AcuityBookmarks. All Rights Reserved.
