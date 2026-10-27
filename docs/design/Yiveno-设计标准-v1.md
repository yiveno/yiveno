# Yiveno 设计标准 v1.5

| 项                      | 内容                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 状态                    | **Normative（规范）**                                                                                                          |
| 生效                    | 2026-08-15（v1.5：2026-08-20；**官网响应式契约**：2026-10-26）                                                                 |
| 品牌色 / Roles 权威实现 | [`packages/design-tokens/css/brand.css`](../../packages/design-tokens/css/brand.css)（官网已接入；`site-critical.css` 仅壳层） |
| 机器可读摘要            | [`docs/design/DESIGN.md`](./DESIGN.md)                                                                                         |
| 产品定位权威            | [`docs/product/Yiveno-产品文档-v4.0.md`](../product/Yiveno-产品文档-v4.0.md) §0                                                |
| 冲突时                  | **产品文档 §0 > 本标准 > 旧实验色 / 历史 logo 备注色**                                                                         |

---

## 0. 目的与适用范围

本标准定义 Yiveno **视觉与交互气质的统一约束**，用于后续所有：

- 官网与营销落地页
- Chrome 扩展（Side Panel 找回主壳 / 记忆库 / 设置 / 详情等）
- Logo、favicon、OG、商店图、邮件、幻灯、印刷与社交物料
- 设计令牌（**自研 Brand Core + 产品角色**；不以第三方主题生成器为标准）
- 对内演示、对招聘/合作方的视觉呈现

**本标准不替代产品功能规范。** 功能、数据流、LLM 边界以产品文档为准；**术语（Filter / Recall / clue 等）唯一权威**见 `docs/product/Yiveno-术语表.md`。

### 0.1 权威声明（必须遵守）

1. **官网色彩基调 = Yiveno 品牌核。** Ink / Paper / Sage 已敲定，日常优化不得换皮。
2. **Brand Core + Product Roles 权威在 `@yiveno/design-tokens/css/brand.css`。** Roles **v1 已冻结**。官网与扩展均直接消费 Roles；扩展自研控件（`AppButton` 等）+ Lucide 内联图标。增补角色须先在官网验证再写入 §3.3 与 `brand.css`。
3. **历史上的实验色板 / Theme Builder / 蓝紫实验色 = 废弃，不作标准。**
4. **其他产品面跟进官网沉淀后的 token。**
5. **扩展图标：Lucide 线框按需内联（`AppIcon`）**——禁止第二套图标库 / 图标字体 CDN。

---

## 1. 品牌性格与设计北星

### 1.1 性格关键词

沉稳 · 直接 · 可托付 · 安静 · 智能 · 人性 · 克制 · 持久

技术应显得有力，但**不必在视觉上大声宣布自己**。

> 目标感受：「这东西安静地懂我。」  
> 反感：「看我们的 AI 多强。」

### 1.2 视觉公式

**Quiet Technology + Editorial Precision + Personal Memory**

（安静科技 + 编辑精度 + 个人记忆）

### 1.3 产品一句话（视觉亦须服务）

Yiveno = **扔进就记着 + 想找就找得着**（Capture 低负担 + Recall 高置信邻域）。

核心资产是**附着原文的个人痕迹**（摘录 + 附注）；书签是配角。

### 1.4 明确不是什么（视觉禁止滑向）

| 禁止滑向             | 典型错误视觉                            |
| -------------------- | --------------------------------------- |
| AI 工具 / ChatGPT 壳 | 紫渐变、光球、脑/机器人、对话气泡主视觉 |
| 书签管理器           | 文件夹树、彩色标签墙当主画面            |
| 知识库 / Notion      | 白板卡片网格、数据库表格 hero           |
| 生产力仪表盘         | 首屏大仪表盘截图、KPI 条                |
| 奢侈时尚站           | 过度衬线装饰、大片留白无产品证明        |

---

## 2. 品牌色彩核（Brand Core）— 锁定

### 2.1 主色板（Normative）

| Token          | Hex                                   | 角色              | 典型用途                                  |
| -------------- | ------------------------------------- | ----------------- | ----------------------------------------- |
| **Ink**        | `#192420`                             | 品牌深色          | Hero、深色段、深底 Logo/OG、theme-color   |
| **Ink Mid**    | `#1e2c26`                             | 深色变体          | 深底分层、次级深面                        |
| **Paper**      | `#f0f3ee`                             | 品牌浅底          | 默认页面底、内容区                        |
| **Paper Dim**  | `#e8ece5`                             | 浅底交替          | 间隔段、页脚、次级纸面                    |
| **Sage**       | `#4b6054`                             | 品牌强调 / 主操作 | 主按钮、Closest 徽章、关键强调            |
| **Sage Dark**  | `#3a4e44`                             | 强调悬停/按下     | Primary hover                             |
| **Sage On**    | `#d8ede2`                             | 强调色上的前景    | 主按钮文字/图标                           |
| **Charcoal**   | `#222c24`                             | 浅底主文字        | 正文                                      |
| **Muted**      | `#586860`                             | 次级文字          | 说明、meta                                |
| **Border**     | `#ced8cb`                             | 分割线            | hairline、卡片描边                        |
| **Sage Muted** | `#82998c`                             | 弱强调            | 标签、次要图标                            |
| **Sage Faint** | `#c6d6ca`                             | 极弱强调          | 引用条、淡分割                            |
| **Hero FG**    | `#dce8de`                             | 深底主文字        | Hero 标题                                 |
| **Hero Muted** | `color-mix(sage-on 55%, transparent)` | 深底次文字        | Hero 副文案（实现见 `site-critical.css`） |
| **Danger**     | `#a05a3c`                             | 错误              | 表单错误（克制，非警报红）                |

### 2.2 使用比例（经验法则）

- **Paper / Ink**：大面积（底与门面）
- **Charcoal / Muted / Hero FG**：文字
- **Sage**：≤ 约 10–15% 视觉权重（行动与强调）
- **Danger**：仅错误态

### 2.3 硬禁止（品牌色）

- 亮紫、电蓝、霓虹、彩虹渐变作为品牌或主 CTA
- 第二套「产品主色」（例如扩展另立亮绿 `#1d6b4f` 当品牌）
- 用高饱和色表达「AI / 智能」
- 纯黑 `#000` 大面积替代 Ink（除非极端打印/单色工艺）

### 2.4 派生规则

允许：

- 同色相透明度 / `color-mix` 做 hover、disabled、scrim、state layer
- 在 Brand Core 之上增加 **语义角色别名**（见 §3），仍指向同一色相

不允许：

- 另选无关色相再称为「Yiveno 色」
- 为「多皮肤」引入第二套主色宇宙（除非未来产品明确要主题市场）
- 再引入第三方 Theme 生成器作为色板权威

---

## 3. 色系演进：官网冻结 → 外推

Yiveno 追求**长期维护与品牌特色**，不以「标准组件库快速上色」为色板路径。

### 3.1 两层模型

| 层                | 内容                    | 状态                                             |
| ----------------- | ----------------------- | ------------------------------------------------ |
| **Brand Core**    | §2 锁定核色             | ✅ 已定稿                                        |
| **Product Roles** | 语义角色 + space/radius | ✅ **v1 冻结**；官网 + 扩展业务 CSS；MW 经 alias |

### 3.2 外推流程（Normative）

1. **权威实现：** [`packages/design-tokens/css/brand.css`](../../packages/design-tokens/css/brand.css)（TS：`src/brand.ts`）。
2. 增补角色：先在官网组件验证 → 写入本标准 §3.3、`docs/design/DESIGN.md`、`brand.css` → 再外推。
3. **已完成：** Brand 进包；官网/扩展业务 CSS 写 Roles + `--space-*` / `--radius-*`；扩展自研控件 + Lucide 内联图标；语义色直连 Roles。
4. **维护：** 增补 token 先写 `brand.css` + §3.3，再外推。
5. Logo / OG / 邮件跟 Brand Core。

**原则：** 外推面不得另立第二套主色；未写入 §3.3 的角色不急着铺进 Side Panel（召回主壳）。

### 3.3 产品角色冻结表（v1 · 可外推）

| 角色 token                    | 语义                 | 初值 / 派生                                   |
| ----------------------------- | -------------------- | --------------------------------------------- |
| `--surface`                   | 默认浅表面           | Paper                                         |
| `--surface-2`                 | 次级浅表面           | Paper Dim                                     |
| `--surface-ink`               | 深门面               | Ink                                           |
| `--surface-raised`            | 浅抬升面（卡/toast） | `color-mix(paper 72%, white)`                 |
| `--surface-white`             | mock 控件底          | `#ffffff`                                     |
| `--surface-chrome`            | mock 窗框条          | `color-mix(paper, paper-dim)`                 |
| `--surface-accent-soft`       | Closest / 强调浅底   | `color-mix(sage 14%, paper)`                  |
| `--on-surface`                | 浅底主文字           | Charcoal                                      |
| `--on-surface-muted`          | 浅底次文字           | Muted                                         |
| `--on-ink`                    | 深底主文字           | Hero FG                                       |
| `--on-ink-muted`              | 深底次文字           | Hero Muted                                    |
| `--accent`                    | 主操作 / 强调        | Sage                                          |
| `--accent-hover`              | 强调悬停             | Sage Dark                                     |
| `--on-accent`                 | 强调上前景           | Sage On                                       |
| `--border`                    | 分割线               | Border                                        |
| `--border-strong`             | 控件描边             | `color-mix(border 62%, charcoal)`             |
| `--danger`                    | 错误                 | Danger                                        |
| `--focus-ring`                | 焦点环               | `color-mix(accent 45%, transparent)`          |
| `--danger-ring`               | 错误焦点环           | `color-mix(danger 45%, transparent)`          |
| `--shadow-ink-sm`             | 小抬升阴影（Ink 相） | 多层 `color-mix(ink …)`                       |
| `--shadow-ink-md`             | 中抬升阴影           | 多层 `color-mix(ink …)`                       |
| `--disabled-opacity`          | 禁用透明度           | `0.55`                                        |
| `--space-2xs` … `--space-3xl` | 间距阶梯             | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px        |
| `--radius-xs` … `--radius-xl` | 圆角                 | 4 / 8 / 10 / 12 / 16 px（另 `--radius-full`） |

**场景覆盖（不升为跨产品角色）：** `--nav-*` 仅官网 Nav 深/浅切换。首页以 `data-nav-over-hero` 为准：采样**顶栏背后**是否落在 Ink（`#hero` / `.home-sec--ink`）——是则浅色字 + `logo-mark-on-dark.svg`，否则深色字 + `logo-mark.svg`（`home-page.ts` scroll/resize；勿用「视口内任意 ink」以免 Paper 顶栏被下方深段误切）。

**Core 兼容别名（实现层）：** `--paper-2` → `--paper-dim`；`--line` → `--border`；`--sage-hover` → `--sage-dark`。

亮色为默认。深门面用 `surface-ink` 局部切换，**不必**先上整套系统级 dark scheme。扩展暗色可在外推阶段再定。

### 3.4 明确不做什么

- 不维护 forest/ocean/violet 等多品牌预设
- 不把 Theme Builder 当长期色板源
- 不为了「和 MD 一样全」而一次发明 40+ 角色——**按真实组件需要增量添加，并回写 §3.3**

---

## 4. 字体

### 4.1 品牌字体对

| 角色          | 字体          | 用途                                       |
| ------------- | ------------- | ------------------------------------------ |
| **Display**   | **Fraunces**  | 官网标题、品牌词标、编辑向强调、营销大标题 |
| **Body / UI** | **Work Sans** | 正文、导航、表单、按钮、说明               |

回退：`Georgia, Times New Roman, serif` / `system-ui, sans-serif`。

### 4.2 分面规则

| 面                     | 规则                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| 官网 / 营销 / 幻灯封面 | Fraunces + Work Sans 完整使用                                                              |
| 扩展密集 UI            | **以 Work Sans（或系统 UI）为主**；Fraunces 仅可用于极少品牌点缀，避免小字号衬线降低可读性 |
| Logo 字标              | 与品牌词标一致或经品牌确认的定制字形；不得随意换网红字体                                   |

### 4.3 排版气质

- 标题：自信、字距略收（约 -0.03em 量级）、行高紧凑
- 正文：字重可偏 300–400，行高宽松（营销约 1.6–1.8）
- 斜体 Fraunces 用于从句/强调，勿整页斜体化

### 4.4 禁止

- 以 Inter / Roboto / Arial 作为**品牌声线**（系统回退除外）
- 时尚杂志式过度装饰衬线
- 在 11px 以下堆 ALL-CAPS 作为主要层级（徽章类 ≥12px）

### 4.5 字号阶梯（待定）

扩展密集 UI **尚未**冻结 `--text-*` 字号 token。间距/圆角以 §3.3 `--space-*` / `--radius-*` 为准；stylelint 仅门禁间距与圆角的裸 `px`（1–2px 发丝光学微调除外）。  
**禁止**为消 lint 警告而从历史写死像素反推一串字号别名；若要定 type scale，须先在本节写明语义档（如 caption / body / title）再接线。

---

## 5. 形状、深度、运动

### 5.1 圆角

- 控件默认 **10px**
- 小元素 **8px**，大卡片 **12px**
- 避免「万物大胶囊」

### 5.2 深度

- 优先：纸面色阶差 + 1px `border`
- 阴影：轻、低、偏 Ink 色相；禁止多层霓虹 glow、厚重拟物
- 禁止玻璃拟态堆叠作为品牌语言

### 5.3 交互态（全产品硬约束）

`:hover` / `:focus` / `:active`：

- ✅ 背景、透明度、描边、outline、state layer
- ❌ `translate` / `scale` / `rotate`（浮层入场与产品文档允许的例外除外）

### 5.4 运动

- 目的：理解与氛围，不是表演
- 允许：scroll reveal、结果列表 stagger、光标闪烁、短淡入
- 禁止：全页视差、常驻漂浮物、循环渐变动画、夸张 AI 粒子
- 必须尊重 `prefers-reduced-motion`

---

## 6. 分面应用指南

### 6.1 官网 / 营销（Persuade）

- 完整 Brand Core + Fraunces/Work Sans
- **首页信息架构（定稿 · 6 屏）：**
  1. **Hero** — 纯文案居中：epithet + H1（单行）+ 支持句（含 Chrome 扩展）；**无**产品 mock、**无** waitlist / 预约表单
  2. **Boundary** — GEO is / isn't（品类 + 反神谕，尽早）
  3. **Mechanism** — Organize Before → Save. Forget. Recall.
  4. **Capture** — 划存 mock + 附注
  5. **Recall proof** — 口语 clue 例子（少而硬）+ 短 types（非词云）
  6. **Trust** — Privacy 要点（无预约收尾）
- **Hero 文案层级（已采纳 · ADR-012）：**
  - **Epithet（小字，非 H1）：** _The one that finds things_ — 心智标签
  - **H1（最大字）：** _Find what you saved._ — 可验证履约
  - **禁止**把裸 _Find things._ 单独占最大标题（易读成通用搜）
  - **首页标题排版：** 禁止用 `<br>` 做装饰性断行；桌面尽量一行读完，**窄屏/平板按词自然折行**（`text-wrap: balance`），禁止 `nowrap` 撑出横向滚动
- 预发阶段：Nav 诚实（勿假装已上线完整账号体系）；营销 Nav 可挂 **Sign in**（进 `/login`）；Pricing 入口可仍隐藏；首页**不**挂邮箱预约 / Notify me
- **语言切换（营销 Nav）：** 触发器 = 地球标 + **当前语言本语种名**（`English` / `中文`）+ chevron → 浮层标题 **LANGUAGE / 语言** + 选项列表（本语种自指、选中态高亮）。仅 en / zh_CN，**不做**多国旗网格（语言≠国旗；闭集两档用列表即可）。禁止只用「Match browser」当唯一可见文案。首访默认 `system`；点选后持久化为 `en` / `zh_CN`
- 产品证明放在屏 4–5；若展示 Closest/邻域 mock，**禁止空结果区**
- 文案禁用用户可见的「搜索 / Search」产品名词（见产品文档）
- **禁止**把 Demo / Problem / Compounds / 三卡 Proof / Types 马赛克再拆成独立长段重复同一说服点

#### 6.1.1 官网响应式（Normative · 底座契约）

官网可在任意浏览器设备打开；布局范式 = **Responsive Design + 少量关键断点 + 内容驱动**。

| 原则          | 要求                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| CSS 优先      | Grid / Flex / `minmax()` / `clamp()` / 媒体查询完成布局；**禁止**为换版式用 JS 量宽切 DOM            |
| 移动优先      | **默认写窄屏合理布局**，再用 `min-width` **逐步增强**到平板/桌面；禁止「桌面定稿再往下砍」当默认路径 |
| 内容最大宽    | 主内容 `--max: 1120px`（与实现一致）；超宽屏不铺满全视口                                             |
| 流式字号/间距 | `clamp()` 设上下限；少写死每设备字号                                                                 |
| 同一组件      | **禁止**为手机维护第二套页面/组件，除非交互或内容确有实质差异                                        |
| 无横向滚动    | 表单、长 URL、卡片、首页 mock **必须**在窄屏抽测无横向溢出                                           |

**官网唯一断点闭集（禁止页面再发明魔法像素）：**

| Token 名（文档） | 字面量   | 用途                                               |
| ---------------- | -------- | -------------------------------------------------- |
| **md**           | `640px`  | 导航稍松；可开始考虑舒适双列密度                   |
| **lg**           | `960px`  | 营销多栏（Capture / Organize / Examples / GEO 等） |
| **xl**           | `1280px` | 可选；仅大气留白或极宽编排，**默认少用**           |

实现约定（`website/src/styles/site-critical.css` 注释同步）：

- `@media` **须写字面量**（`640px` / `960px` / `1280px`）；CSS 变量不能可靠用于 media query。
- 增强查询优先：`@media (min-width: 960px)`；避免新增 `max-width: 899px` 类桌面优先查询（存量迁移中）。
- 能内容驱动则先内容驱动：如 Pricing `auto-fit` + `minmax(min(100%, 260px), 1fr)`，少为「变两列」单独开断点。
- **验收（可执行，非像素级精修）：** 在 ~390 / ~768 / ~1280 视口：无横向滚动、主文可读、主路径可点、导航不挤爆。

### 6.2 Chrome 扩展（Operate）

- 色相跟 Brand Core；业务样式写 Roles；自研控件（`AppButton` / `AppSwitch` / `AppModal` / `AppConfirmModal` / `AppTextarea` / `AppSectionTabs` 等）
- 密度高于官网；图标优先（Lucide 内联）+ `title`/`aria-label`
- 术语：Filter / Recall，禁止 Search
- Closest / 邻域列表的视觉层级必须可读
- 不把营销大留白硬搬进 Side Panel；**不在扩展侧另开一套实验色**

#### 6.2.1 Modal Dialog（`AppModal`）

**何时用：** 需打断主流程的确认、表单、不可逆操作（删除记忆/账号、退出登录选项等）。

**何时不用：** 能用 inline 编辑、toast、侧栏说明解决的，不弹 Modal。

**结构（固定）：** 遮罩（`--ink` 42% scrim）→ 白卡片（`--surface-white` + `--shadow-ink-md`）→ 标题 → 可选说明 → 内容 slot → 错误 → actions（`AppButton`）。

**尺寸：** `sm` = 420px（默认）；`md` = 520px（多选项，如 Sign out）。

**交互（必须）：**

| 行为           | 默认                                             |
| -------------- | ------------------------------------------------ |
| Esc 关闭       | ✅（`loading` 时禁用）                           |
| Tab 焦点陷阱   | ✅                                               |
| 关闭后焦点还原 | ✅                                               |
| 点遮罩关闭     | ❌（全部 Modal；须显式 Cancel / 操作按钮 / Esc） |
| 危险主操作     | `AppButton tone="danger"` + outlined             |

**禁止：** `window.confirm` / `window.alert` 作为用户面向确认；遮罩用 slate 等非 `--ink` 色；hover/focus 几何变换。

**实现：** `extension/src/infrastructure/ui/AppModal.vue`；业务页只填 slot，不复制 overlay CSS。

**确认类（`AppConfirmModal`）：** Cancel + Confirm 双按钮的薄封装；`confirmTone="danger"` 用于删除等不可逆操作。正文用 `body` prop 或 default slot；多按钮/表单仍直接用 `AppModal`。

#### 6.2.2 页内分区 Tab（`AppSectionTabs`）

**何时用：** 同一整页内切换右侧面板（Settings 分区、Library 类型 Tab 等）。

**何时不用：** 跨页跳转（`AppPageHeader` nav）；Modal 内分段；纯装饰分组标题。

**语义：** WAI-ARIA Tabs（`tablist` / `tab` / `tabpanel`）；**不叫 Nav**——Nav 保留给应用级跨页导航。

**布局：** `layout="responsive"`（默认）= 宽屏侧栏竖排、≤640px 顶栏横排 chips；`side` / `top` 固定方向。

**选中态：** 轨道 `--surface-raised`；当前项 `--surface-accent-soft` + `--on-surface`。禁止纯 `#fff` 块（与纸色底反差过强）；右侧面板仍用 `--surface-white`。

**实现：** `extension/src/infrastructure/ui/AppSectionTabs.vue`；`items[].label` 由页面经 `t()` 解析；`panelId` + `idPrefix`（`useId()`）关联右侧 `role="tabpanel"`。

#### 6.2.3 轻提示 Toast（`AppToast` / `AppToastHost`）

**何时用：** 非阻断操作反馈（复制/下载完成、同步成功、可自动消失的失败提示等）。

**何时不用：** 需用户确认 → `AppModal`；持久错误区块 → 页内 `role="alert"`；Recall 结果 → 邻域卡面。

**结构：** 页面根挂载 `<AppToastHost />`（`Teleport` 到 `body`）→ 顶部居中浮层 → `AppToast`（图标 + 文案）；无手动关闭钮，默认自动消失。

**语气：** `info` / `success` / `warning` / `error`；各态左侧 Lucide 图标（语义色）；文案经 `t()`；默认 ~3.2s 自动消失；`error` 用 `aria-live="assertive"`。

**尺寸：** 宽度随文案收缩（`fit-content`），`max-width` 约 420px（窄屏留边距）；长文案换行，短文案不留大片空白。

**交互：** 仅 opacity 入场；**禁止** hover/focus/active 几何变换；`pointer-events: none`（不挡底层操作）。

**API：** `useAppToast().success(message)` / `.warning()` / `.error()` / `.info()`；同一扩展页单例队列（最多 3 条）。

**实现：** `AppToast.vue` · `AppToastHost.vue` · `use-app-toast.ts`。

**已接入（P0）：** Library / Side Panel Detail export（copy & download）；Settings 导出/导入/同步/清库等操作完成反馈。

#### 6.2.4 Detail export 多选（条目即选择器）

**交互：** 进入多选后点**条目主体**切换选中；**禁止**左侧插入勾选列导致布局横跳。选中态 = 描边/浅底 + 角标勾（overlay，不占流式宽度）。退出多选恢复「点即打开」。附注/删除/展开集合等行内钮仍独立可点。

**范围：** Library 摘录列表 · 书签树 · Side Panel Recall 结果卡（含 sibling）。

**底栏动效：** 进入多选时 `DetailExportBar` 经 `DetailExportBarDock` **自下而上滑入**（~280ms emphasized easing）；Cancel 离场 **向下滑出**（~220ms）。`prefers-reduced-motion` 时仅 opacity 淡入淡出。

#### 6.2.5 Library 列表 rhythm（摘录 + 书签）

**条目壳：** `AppLibraryItemCard` 固定**三行**：

1. **标题 + 操作**（`space-between`；`#title` + `#actions`）
2. **附注**（`#note`，可选）
3. **来源等信息 + 时间**（`space-between`；`#footer` + `#time`；书签第三行展示域名 + **保存时间**）

**保存时间（Normative）：** 摘录与书签列表均展示 **创建/收藏时刻**（非 `updatedAt`）。摘录 = `createdAt`；书签 = `payload.chromeCreatedAt`（Chrome `dateAdded`），未同步 Memory 时回退 Chrome `dateAdded`。格式化经 `formatLibrarySavedAt()`。

**行首图标（Normative）：** `#leading` 为源站 favicon（`getChromeFaviconUrl` / Chrome `/_favicon/` 缓存）。摘录用 `sourceUrl`，失败回退 Lucide `format_quote`；书签用 `url`，失败回退 `bookmark`。Recall 结果卡仍保持摘录角标 `format_quote`、书签角标 favicon（类型分工不变）。

**插槽排版：** `library-item-card-content.css` 内 `.lib-item-*`；页面禁止再写第二套 row 样式。

**行间距：** `--library-list-row-gap` = `--space-xs`（摘录 `grid gap`；书签虚拟列表 stride 含同等间距）。

**卡片内边距：** 四向 `--space-sm`；操作钮在行内流式布局，**禁止**再预留 84px 右 padding。

**操作钮显隐：** 指针设备（`hover: hover`）默认隐藏 `#actions`，悬停条目或 `focus-within` 时淡入；触屏无 hover 时保持常显。detail export 多选模式仍不渲染操作钮。

**圆角/描边：** `--radius-lg` + `--border`；背景 `--surface`。文件夹行非 `AppLibraryItemCard`。

**实现：** `AppLibraryItemCard.vue` · `library-item-card-content.css` · `library-list-tokens.ts` · `bookmark-library-index.ts`。

#### 6.2.6 Recall 邻域结果卡壳（类型区分）

**目标：** 列表先可扫可读可点；类型可辨，但不抢主阅读。

| 层          | Normative                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| 卡壳        | 书签 / 摘录 **同** `--surface-white` 底、同 `--border`、**同 hover**（`--surface-chrome`）                     |
| 类型        | 角标（quote / favicon）+ 内容形（引文正文 vs 页标题）；摘录可 **≤1px** 左侧 accent（`inset` 阴影，非整卡铺色） |
| 选中 / 键盘 | 共用 accent 描边 + `--surface-accent-soft`；不跟类型底色纠缠                                                   |

**禁止：** 用整卡分色区分书签/摘录（易成斑马纹 + 双套 hover）。

**实现：** `RecallResultCard.vue`。

### 6.3 Logo 与图标物料

- 主色：Ink / Sage；浅底用 Ink 或 Sage；深底用 Sage On / Paper 系浅色
- 透明底 PNG/SVG；小尺寸可简化路径
- **theme-color / OG 深底：Ink `#192420`**
- 禁止再用旧文档中的 navy `#1E2640`、蓝 `#3B82F6`、紫渐变作为品牌默认

#### 6.3.1 账户头像 fallback（Normative）

无第三方头像 URL 时（Email OTP、OAuth 未给图、图加载失败）：

| 优先级 | 展示                                                                        |
| ------ | --------------------------------------------------------------------------- |
| 1      | 用户 / IdP `avatarUrl`（圆形裁切）                                          |
| 2      | **Yiveno 品牌标**（`logo-mark.svg`；浅底圆 + 内边距 `object-fit: contain`） |
| —      | **禁止**用邮箱 / 展示名**首字符**作默认（数字、符号无识别价值）             |

- 官网：`/account`、顶栏 `AuthNav`
- 扩展：已登录顶栏账户钮；**未登录**仍可用 Lucide `account_circle` 作「去登录」入口暗示
- 现阶段**不**另开专用「默认头像」插画；复用现有 mark。专用画风物料须先过品牌评审再替换本条

### 6.4 邮件 / 商店图 / 幻灯 / 印刷

- 同一色核与字体对
- 一张图只打一个信息：找回 / Capture / 信任，勿堆功能宫格
- 商店截图优先真实产品 UI（扩展），色相须已跟新 token

### 6.5 未来 App / 其他客户端

- 先继承 Brand Core + 官网已验证的产品角色
- 再按平台密度增减角色，不得另立第三套主色

---

## 7. 文案与视觉的交叉约束

视觉与文案必须一起守线：

| 宜                                     | 不宜                        |
| -------------------------------------- | --------------------------- |
| Find what you saved.（Hero H1）        | AI-powered bookmark manager |
| The one that finds things（Hero 小字） | 裸 Find things. 占最大标题  |
| find things（宽语义 · 勿说死成文件搜） | 「又一个 AI 找相册/网盘」   |
| What do you remember?                  | Search your bookmarks       |
| Closest matches — you pick             | 99% confidence / 神谕单答   |
| Save first. Organize later — or never. | 自动整理一切                |
| Your memories are yours.               | 企业级安全徽章墙（无依据）  |

**预留翻牌句（未启用 · 后手 · ADR-012）：** _Why should things just be things?_ ——视发展再定；不得升为当前官网/物料主句，直至产品文档明确启用。可以 ≠ 必须。

开发期叙事（越用越好用）**不得**在视觉或文案上暗示「第一天是坏产品」。

---

## 8. 无障碍与诚实

- 目标：WCAG 2.2 AA 常用项（对比、焦点、键盘、减少动效）
- 主按钮 Sage on Ink/Paper 组合须抽检对比
- 只展示已上线或诚实标注的能力（coming soon / at launch）
- 隐私与训练相关声明须可与真实政策核对后再上物料

---

## 9. 实施清单（换皮 / 新建物料自检）

### 9.1 品牌核

- [ ] 仅使用 §2 色板或其合法派生
- [ ] 无紫/电蓝/霓虹品牌强调
- [ ] theme-color / 关键色块为 Ink 或 Paper

### 9.2 字体

- [ ] 营销面为 Fraunces + Work Sans
- [ ] 扩展面可读性优先，未滥用小字号衬线

### 9.3 产品 UI token

- [x] Roles v1 已在官网冻结（§3.3），并迁入 `@yiveno/design-tokens/css/brand.css`
- [x] 扩展业务 CSS 写 Roles；自研控件；Lucide 内联图标
- [x] 间距/形状自研；`semantic-colors.css` 直连 Roles
- [ ] 新角色仍先在官网验证，再写入 §3.3 / `brand.css` 再外推

### 9.4 营销 / 证明

- [ ] 存在线索 → Closest 证明，且非空
- [ ] 无 Search 主隐喻（含放大镜当英雄图标）
- [ ] Waitlist 诚实

### 9.5 物料

- [ ] Logo/OG/邮件与 §2 一致
- [ ] 未引用旧蓝紫实验色

---

## 10. 版本与变更

| 版本   | 日期       | 说明                                                                          |
| ------ | ---------- | ----------------------------------------------------------------------------- |
| v1.0   | 2026-08-15 | 以官网敲定 Brand Core；宣告旧实验色非标准                                     |
| v1.1   | 2026-08-16 | 废弃旧色板路径；官网为色系试验场，角色层在官网补全后再外推                    |
| v1.2   | 2026-08-20 | Roles v1 冻结可外推；权威实现先落官网 `site-critical.css`；消散落业务 hex     |
| v1.2.1 | 2026-08-20 | Brand Core + Roles 迁入 `@yiveno/design-tokens/css/brand.css`；官网消费该包   |
| v1.3   | 2026-08-20 | 扩展接入 Brand Roles；停用多预设色板运行时                                    |
| v1.4   | 2026-08-20 | 扩展业务 CSS 改写 Roles；删除旧 presets / theme 运行时                        |
| v1.5   | 2026-08-20 | `--space-*` / `--radius-*` 进 brand；semantic 直连 Roles；variables 瘦身      |
| v1.9   | 2026-10-27 | §6.3.1 账户头像 fallback = 品牌标；禁止邮箱/昵称首字符默认                    |
| v1.8   | 2026-10-15 | Modal 一律禁止点遮罩关闭（移除 `closeOnBackdrop`；须显式按钮 / Esc）          |
| v1.7   | 2026-08-23 | 扩展 `AppModal` Modal Dialog 规范（§6.2.1）；禁止 `window.confirm` 作用户确认 |
| v1.6   | 2026-08-22 | 扩展自研 App\* 控件；图标统一 Lucide 按需内联                                 |

**变更规则：**

- 改 Brand Core hex = **品牌变更**，须显式评审，并同步：`docs/design/DESIGN.md`、官网 CSS、Logo/OG 指引；外推面随后跟进。
- 增补产品角色别名 / 阴影 / 透明度 = 先在官网验证，再写入 §3.3，升补丁说明。
- 与产品文档冲突时，先改产品文档再改本标准。

---

## 11. 相关文件

| 文件                                                 | 角色                                                |
| ---------------------------------------------------- | --------------------------------------------------- |
| [`DESIGN.md`](./DESIGN.md)                           | Agent / 工具可读摘要 + YAML tokens                  |
| `packages/design-tokens/css/brand.css`               | **Brand Core + Product Roles 权威实现（:root）**    |
| `packages/design-tokens/css/motion.css`              | 扩展：精简 `--motion-*` 时长/缓动                   |
| `packages/design-tokens/src/brand.ts`                | Brand Core hex（TS）                                |
| `website/src/styles/site-critical.css`               | 官网壳：字体 / 布局 / Nav（消费 brand，无重复 hex） |
| `website/src/styles/site.css`                        | 兼容入口（brand + critical + deferred）             |
| `extension/src/styles/extension-ui.css`              | 扩展入口：brand + variables + semantic              |
| `docs/design/Yiveno-logo-asset-generation-prompt.md` | Logo 导出流程（色值须服从本标准）                   |
| `docs/product/Yiveno-产品文档-v4.0.md` §0            | 产品定位 / 性格（Normative）                        |
| `docs/product/Yiveno-术语表.md`                      | 术语唯一权威（Glossary）                            |
| 产品文档 v4.0 §0                                     | 产品行为/契约 Normative                             |
