# Yiveno 设计标准 v1.5

| 项                      | 内容                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 状态                    | **Normative（规范）**                                                                                                          |
| 生效                    | 2026-08-15（v1.5：2026-08-20）                                                                                                 |
| 品牌色 / Roles 权威实现 | [`packages/design-tokens/css/brand.css`](../../packages/design-tokens/css/brand.css)（官网已接入；`site-critical.css` 仅壳层） |
| 机器可读摘要            | 仓库根目录 [`DESIGN.md`](../../DESIGN.md)                                                                                      |
| 产品定位权威            | [`docs/product/Yiveno-产品文档-v4.0.md`](../product/Yiveno-产品文档-v4.0.md) §0                                                |
| 冲突时                  | **产品文档 §0 > 本标准 > 旧实验色 / 历史 logo 备注色**                                                                         |

---

## 0. 目的与适用范围

本标准定义 Yiveno **视觉与交互气质的统一约束**，用于后续所有：

- 官网与营销落地页
- Chrome 扩展（Popup / 记忆库 / 设置 / 详情等）
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
2. 增补角色：先在官网组件验证 → 写入本标准 §3.3、`DESIGN.md`、`brand.css` → 再外推。
3. **已完成：** Brand 进包；官网/扩展业务 CSS 写 Roles + `--space-*` / `--radius-*`；扩展自研控件 + Lucide 内联图标；语义色直连 Roles。
4. **维护：** 增补 token 先写 `brand.css` + §3.3，再外推。
5. Logo / OG / 邮件跟 Brand Core。

**原则：** 外推面不得另立第二套主色；未写入 §3.3 的角色不急着铺进 Popup。

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

**场景覆盖（不升为跨产品角色）：** `--nav-*` 仅官网 Nav 深/浅切换。

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
- 首屏：品牌 + 一句标题 + 一句支持 + 主 CTA + **找回证明（线索 → Closest）**
- Waitlist 阶段：Nav 诚实（勿假装已上线账号体系）；主行动 = Notify me
- 禁止空的 Closest/结果区
- 文案禁用用户可见的「搜索 / Search」产品名词（见产品文档）

### 6.2 Chrome 扩展（Operate）

- 色相跟 Brand Core；业务样式写 Roles；自研控件（`AppButton` / `AppSwitch` / `AppModal` / `AppConfirmModal` / `AppTextarea` / `AppSectionTabs` 等）
- 密度高于官网；图标优先（Lucide 内联）+ `title`/`aria-label`
- 术语：Filter / Recall，禁止 Search
- Closest / 邻域列表的视觉层级必须可读
- 不把营销大留白硬搬进 Popup；**不在扩展侧另开一套实验色**

#### 6.2.1 Modal Dialog（`AppModal`）

**何时用：** 需打断主流程的确认、表单、不可逆操作（删除记忆/账号、退出登录选项等）。

**何时不用：** 能用 inline 编辑、toast、侧栏说明解决的，不弹 Modal。

**结构（固定）：** 遮罩（`--ink` 42% scrim）→ 白卡片（`--surface-white` + `--shadow-ink-md`）→ 标题 → 可选说明 → 内容 slot → 错误 → actions（`AppButton`）。

**尺寸：** `sm` = 420px（默认）；`md` = 520px（多选项，如 Sign out）。

**交互（必须）：**

| 行为           | 默认                                                 |
| -------------- | ---------------------------------------------------- |
| Esc 关闭       | ✅（`loading` 时禁用）                               |
| Tab 焦点陷阱   | ✅                                                   |
| 关闭后焦点还原 | ✅                                                   |
| 点遮罩关闭     | ❌（表单/危险操作）；Sign out 等可 `closeOnBackdrop` |
| 危险主操作     | `AppButton tone="danger"` + outlined                 |

**禁止：** `window.confirm` / `window.alert` 作为用户面向确认；遮罩用 slate 等非 `--ink` 色；hover/focus 几何变换。

**实现：** `frontend/src/infrastructure/ui/AppModal.vue`；业务页只填 slot，不复制 overlay CSS。

**确认类（`AppConfirmModal`）：** Cancel + Confirm 双按钮的薄封装；`confirmTone="danger"` 用于删除等不可逆操作。正文用 `body` prop 或 default slot；多按钮/表单仍直接用 `AppModal`。

#### 6.2.2 页内分区 Tab（`AppSectionTabs`）

**何时用：** 同一整页内切换右侧面板（Settings 分区、Library 类型 Tab 等）。

**何时不用：** 跨页跳转（`AppPageHeader` nav）；Modal 内分段；纯装饰分组标题。

**语义：** WAI-ARIA Tabs（`tablist` / `tab` / `tabpanel`）；**不叫 Nav**——Nav 保留给应用级跨页导航。

**布局：** `layout="responsive"`（默认）= 宽屏侧栏竖排、≤640px 顶栏横排 chips；`side` / `top` 固定方向。

**选中态：** 轨道 `--surface-raised`；当前项 `--surface-accent-soft` + `--on-surface`。禁止纯 `#fff` 块（与纸色底反差过强）；右侧面板仍用 `--surface-white`。

**实现：** `frontend/src/infrastructure/ui/AppSectionTabs.vue`；`items[].label` 由页面经 `t()` 解析；`panelId` + `idPrefix`（`useId()`）关联右侧 `role="tabpanel"`。

### 6.3 Logo 与图标物料

- 主色：Ink / Sage；浅底用 Ink 或 Sage；深底用 Sage On / Paper 系浅色
- 透明底 PNG/SVG；小尺寸可简化路径
- **theme-color / OG 深底：Ink `#192420`**
- 禁止再用旧文档中的 navy `#1E2640`、蓝 `#3B82F6`、紫渐变作为品牌默认

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
| Find what you saved                    | AI-powered bookmark manager |
| What do you remember?                  | Search your bookmarks       |
| Closest matches — you pick             | 99% confidence / 神谕单答   |
| Save first. Organize later — or never. | 自动整理一切                |
| Your memories are yours.               | 企业级安全徽章墙（无依据）  |

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
| v1.7   | 2026-08-23 | 扩展 `AppModal` Modal Dialog 规范（§6.2.1）；禁止 `window.confirm` 作用户确认 |
| v1.6   | 2026-08-22 | 扩展自研 App\* 控件；图标统一 Lucide 按需内联                                 |

**变更规则：**

- 改 Brand Core hex = **品牌变更**，须显式评审，并同步：`DESIGN.md`、官网 CSS、Logo/OG 指引；外推面随后跟进。
- 增补产品角色别名 / 阴影 / 透明度 = 先在官网验证，再写入 §3.3，升补丁说明。
- 与产品文档冲突时，先改产品文档再改本标准。

---

## 11. 相关文件

| 文件                                                 | 角色                                                |
| ---------------------------------------------------- | --------------------------------------------------- |
| [`DESIGN.md`](../../DESIGN.md)                       | Agent / 工具可读摘要 + YAML tokens                  |
| `packages/design-tokens/css/brand.css`               | **Brand Core + Product Roles 权威实现（:root）**    |
| `packages/design-tokens/css/motion.css`              | 扩展：精简 `--motion-*` 时长/缓动                   |
| `packages/design-tokens/src/brand.ts`                | Brand Core hex（TS）                                |
| `website/src/styles/site-critical.css`               | 官网壳：字体 / 布局 / Nav（消费 brand，无重复 hex） |
| `website/src/styles/site.css`                        | 兼容入口（brand + critical + deferred）             |
| `frontend/src/styles/extension-ui.css`               | 扩展入口：brand + variables + semantic              |
| `docs/design/Yiveno-logo-asset-generation-prompt.md` | Logo 导出流程（色值须服从本标准）                   |
| `PRODUCT.md`                                         | 产品性格（Impeccable）                              |
| `docs/product/Yiveno-术语表.md`                      | 术语唯一权威（Glossary）                            |
| 产品文档 v4.0 §0                                     | 产品行为/契约 Normative                             |
