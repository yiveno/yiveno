---
created: 2026-10-30T23:47:14+08:00
updated: 2026-10-31T01:53:37+08:00
author: agent:cursor
scope: 全局盘点仓内 UI/品牌资产；划分 Figma vs Git vs 代码职责；不改运行时资产
status: screenshot-thaw-partial
upstream:
  - docs/design/Yiveno-设计标准-v1.md
  - docs/design/DESIGN.md
  - docs/design/brand-assets/README.md
  - docs/design/brand-asset-release-checklist.md
  - docs/diagrams/README.md
  - docs/engineering/Yiveno-Mermaid图表规范.md
  - packages/design-tokens/
  - extension/src/infrastructure/ui/
  - CHROMEWEBSTORE.md
  - EDGEADDONS.md
downstream:
  - docs/design/figma-index.md（已建 · 含 App* 对照表）
  - Figma folder 639346673：00–90；Brand Assets/Usage；Extension App* 组件集
  - 不推翻 Mermaid 业务图单源（docs/diagrams）
  - 截图 / 商店定稿导出：暂缓
---

# UI 资产与 Figma 职责分配（2026-10-30）

## 1. 结论（先看这）

Yiveno **今天几乎没有产品 UI / 品牌在 Figma 里维护**；视觉权威在 **设计标准 MD + `@yiveno/design-tokens` + 仓内 `brand-assets/`**，界面权威在 **Vue/Astro 实现**。

**不该**把一切搬进 Figma。合理分工是：

| 系统                                      | 职责                                                                |
| ----------------------------------------- | ------------------------------------------------------------------- |
| **Figma Design**                          | 品牌探索、营销/商店构图、关键屏 comps、可复用组件视觉稿（设计意图） |
| **Git `brand-assets/` + sync**            | **可发版二进制/矢量母本**（Logo、图标、promo、OG）                  |
| **`@yiveno/design-tokens` + 设计标准**    | **颜色/Roles/间距等 Normative 实现**                                |
| **扩展/官网代码**                         | **可交互产品 UI 真相**（含 App\* 控件、i18n、Lucide/`AppIcon`）     |
| **Markdown + Mermaid（`docs/diagrams`）** | **业务逻辑图**（已钉死单源；**禁止**改由 FigJam 接管）              |

FigJam 仅作可选协作白板；**不当** UI 或品牌权威。

---

## 2. 现状盘点

### 2.1 仓内已有「UI 相关」资产

| 类别                    | 位置                                                                 | 现状                                             | 是否在 Figma                                        |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| Brand Core / Roles      | `packages/design-tokens/css/brand.css`、`DESIGN.md`、设计标准 §2–§3  | 已冻结、官网+扩展消费                            | **00 Brand Variables**（权威仍 brand.css）          |
| Logo / mark SVG·PNG     | `docs/design/brand-assets/logo/` → sync → `public/`                  | LFS 母本 + 发版脚本                              | **00 Assets · ship masters**（Components）          |
| 扩展图标 16–512         | `brand-assets/chrome-extension/`                                     | 母本齐全                                         | **00** SVG + size ladder 16/32/48/128/256/512       |
| CWS / Edge promo + 截图 | `brand-assets/chrome-web-store/`                                     | promo ✅；Screenshot 1–3 产品空态 ✅；Capture ⬜ | **30** 已叠 01–03                                   |
| 营销应用图 / OG         | `brand-assets/applications/`、`website/public/og-image.jpg`          | 有母本                                           | **00** Applications + OG；favicon/touch 套          |
| 色板参考图              | `docs/design/brand/color-palette.png`                                | 参考物料                                         | **00** Assets 参考图（Variables 仍权威）            |
| 扩展 App\* 控件         | `extension/src/infrastructure/ui/*`（Button/Modal/Toast/Tabs/Card…） | 代码即实现                                       | **核心已迁**（见 figma-index 对照表）               |
| 扩展图标路径            | `AppIcon` + `icon-paths`（非外链 Lucide 包）                         | 内联 path 闭集                                   | 否（Figma 仅占位字形）                              |
| 产品主壳                | Side Panel / Getting Started / Library / Detail / Settings           | 大 Vue 面                                        | **20** 中保真（含 Settings / Detail；真机截图暂缓） |
| 官网营销 7 屏           | `website/src/pages` + 设计标准 §6.1                                  | 代码实现 IA                                      | **10** 布局级 comps（实现仍 Astro）                 |
| 官网账号/登录           | LoginForm / Account / Pricing 等                                     | 代码                                             | **10 Auth shells**（Login / Account；Pricing 未开） |
| 业务流程图              | MD Mermaid + `docs/diagrams/registry.json`                           | 工程单源已定                                     | **明确不进 Figma**                                  |

### 2.2 Figma 侧（本会话可验证）

- 团队 **yiveno** 可写；folder `639346673` **可新建文件**（已探测）。
- MCP **不能**枚举 folder 内既有文件；无全库 UI kit 证据。
- 业务图方向已与 FigJam 试点**分轨**：规范写明不引入 FigJam 为权威。

---

## 3. 职责分配（推荐）

### A. 应由 Figma Design **接管设计意图**（高优先）

这些适合「先画后导出」，而不是只在 PNG/JPG 里改：

1. **品牌核视觉包**  
   Logo 字标/图形变体、深浅底、禁区、最小字号、错误用法对照。  
   → 定稿后 **导出** 到 `docs/design/brand-assets/logo/`（Git 仍为发版母本）。

2. **商店与社媒构图板**  
   CWS/Edge：1280×800 产品 UI 截图框、440×280 / 1400×560 promo 构图、社媒方图。  
   → 解决 CHROMEWEBSTORE「Screenshot 3–5 Product UI pending」。  
   → 导出进 `brand-assets/chrome-web-store/`（不进扩展包）。

3. **官网营销关键帧 comps**  
   设计标准 §6.1 七屏：Hero / Boundary / Mechanism / Capture mock / Recall proof / Install / Trust。  
   → Figma 管布局与静帧 mock；**实现仍以 Astro/Vue 为准**。

4. **扩展关键屏 comps（少而硬）**  
   仅：Side Panel 结果邻域、Capture 划存浮层、Getting Started 双 tab、Library 列表卡。  
   → 给评审与商店截图同源；**不**为每个 Settings 开关开板。

5. **（可选）组件视觉库**  
   与 `AppButton` / `AppModal` / `AppLibraryItemCard` / Toast 等一一对应的 Figma Components。  
   → 意图源；**实现与 token 仍以代码 + `brand.css` 为准**（防双真相）。

### B. 保持 Git / 代码权威（Figma 不抢）

| 资产                   | 权威                      | 理由                       |
| ---------------------- | ------------------------- | -------------------------- |
| Brand Core hex / Roles | `brand.css` + 设计标准    | 已机器消费；双写易漂移     |
| 间距 / 圆角 / motion   | design-tokens + stylelint | 工程门禁                   |
| `AppIcon` path 闭集    | 代码                      | 体积与依赖可控；非插画体系 |
| i18n 文案              | `_locales` / website i18n | 产品语言面                 |
| 交互态 / a11y / focus  | Vue 实现 + 产品文档       | Figma 难表达完整行为       |
| 业务逻辑图             | Mermaid + registry        | 已决策；与 UI 资产分轨     |
| ADR / Normative 条文   | MD                        | 非视觉                     |

### C. 混合流水线（推荐默认）

```text
Figma Design（意图 / 构图 / 评审）
    ↓ 导出 SVG/PNG（命名对齐 checklist）
docs/design/brand-assets/（发版母本 · Git LFS）
    ↓ bun run sync:brand-assets
extension/public · website/public · 商店后台上传
```

**硬规则：**

- 禁止只改 `public/` 不同步母本（既有 checklist）。
- 禁止把 Figma 文件当成 Normative「已上线」证明。
- Token 变更：先改设计标准 + `brand.css`，再（可选）回灌 Figma Variables。

### D. 明确不要塞进 Figma

- 全量 Side Panel 状态机 / Recall 管道图 → Mermaid
- 一次性审计截图、eval 报告图
- 第三方站点 favicon
- 生成物 / `dist/`
- FigJam 业务全景当第二权威（与 `docs/diagrams` 冲突）

---

## 4. 合理性判据（为什么这样切）

| 问题                                    | 判据                                                   |
| --------------------------------------- | ------------------------------------------------------ |
| 需要设计师构图、多方案、商店审美？      | → Figma                                                |
| 需要 CI、diff、Agent 同批改、发版脚本？ | → Git                                                  |
| 需要真机交互、MCP 验收？                | → 代码                                                 |
| 需要「谁在何时如何」的业务流？          | → Mermaid（已定）                                      |
| 拿掉 Figma 能否继续发版？               | 今天可以 → 故 Figma 是**增强设计意图**，不是运行时依赖 |

Yiveno 当前是 **代码优先 + 文档 Normative** 产品；Figma 补的是 **营销/商店/关键屏视觉产能**，不是再造一套组件实现真相。

---

## 5. 建议落地顺序（确认后再做）

| 优先级 | 动作                                                                        | 落点                                                                                   |
| ------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| P0     | 在 folder `639346673` 建 Figma 项目结构                                     | `00 Brand` · `10 Marketing` · `20 Extension comps` · `30 Store listing` · `90 Archive` |
| P0     | Logo + Brand Core 从现有 SVG/token **导入** Figma（反哺，非重画）           | Brand 文件 + Variables 对齐 `brand.css`                                                |
| P1     | Store listing：真实 Side Panel / Capture / Library 构图 → 替换 interim 截图 | 导出 → `chrome-web-store/`                                                             |
| P1     | 官网七屏关键帧 comps（与 §6.1 对齐）                                        | Marketing 文件                                                                         |
| P2     | App\* 组件库 8–12 个核心组件                                                | Extension DS 文件；链到代码路径注释                                                    |
| P2     | 仓内短索引 `docs/design/figma-index.md`                                     | 主题 → file URL → 对应母本/代码（MCP 不能扫 folder）                                   |
| —      | **不做**                                                                    | 把 Mermaid 业务图迁 FigJam；把 Roles 唯一权威改成 Figma Variables                      |

---

## 6. 风险

- **双真相：** Figma 与 `brand.css` 色值不一致 → 以 `brand.css` + 设计标准为准，定期对表。
- **过度 comps：** 为每个 bugfix 开板 → 只维护关键屏。
- **与 diagrams 规范冲突：** UI 进 Figma ≠ 业务图进 FigJam；索引里写清分轨。

---

## 7. 落地记录（P0 · 2026-10-31）

已执行：

- Folder `639346673` 内五份 Design 文件（见 [`figma-index.md`](../design/figma-index.md)）
- **00 Brand**：Variables（Brand Core / Product Roles / Spacing / Radius）+ 色板 + `brand-assets/logo` 三份 SVG 导入
- **30 Store listing**：1280×800 ×3、440×280、1400×560 占位框
- **10 / 20 / 90**：封面说明页
- 仓内索引：`docs/design/figma-index.md`

### P1 进展（2026-10-31 续）

已做：

- **10 Marketing**：七屏文案 comps 齐；官网 live 分节参考已进 Figma（仓内 `_captures/*.png` 已清，仅留再生脚本）
- **20 Extension comps**：关键屏线框（Side Panel / Capture / Library / GS）
- **30 Store listing**：promo 母本已入框；截图框叠官网 Capture/Recall mock（非扩展真机）
- **索引**已刷新：[`figma-index.md`](../design/figma-index.md)

仍缺 / 阻塞（非本波必选）：

- **截图波次暂缓** → 不抢真机商店截图 / 定稿导出
- MCP 无法打开 `chrome-extension://` → 真机截图另议
- Library 商店框仍临时用 hero；未导出替换 `chrome-web-store/` 发版母本
- `AppIcon` 全量闭集、`AppToastHost` / `DetailExportBarDock` / Favicon 微件不迁（代码权威）
- Brand Variables 未 Publish 为 team library（20 内镜像 Roles）
- `website/public/og-image.jpg` 未单独导入（可跟 applications 同源）

### 资源移植结案（2026-10-31 · 截图暂缓）

已做：

- **00 Brand**：`Assets · ship masters` — logo 深浅 + Components；chrome-extension SVG + **尺码梯 16–512**；**applications** product-hero / social / packaging；页 `Usage` dos/donts
- **20 Extension**：`App* components` — Roles 镜像 + Button / Switch / IconButton / Toast / Modal / ConfirmModal / SectionTabs / LibraryItemCard / Textarea / LinearProgress / PageHeader / HoverTip / MenuButton / DetailExportBar
- **索引**：[`figma-index.md`](../design/figma-index.md) 组件与 Assets 对照齐

未改 `extension/public` / `website/public` 运行时。

### 派生清理（2026-10-31）

- 已删仓内 `_captures/*.png`；保留 `shot-sections.mjs` + `_captures/README.md`
- `.gitignore` 忽略 `_captures` 下 png/jpg/webp，防再误提交
- Figma 探测板 `A6fqmlxlR0DT58LCETnizA`：MCP 已不可写，请在 folder 内人工确认删除

### 小补全（2026-10-31 · 截图仍暂缓）

已做：

- **00**：`yiveno-primary` + logo PNG；favicon.svg/png、apple-touch、og-image；color-palette 参考；Usage clearspace 视觉条
- **30**：页 `Design sources` — 不合规大图 `small-promo.png` / `marquee.png`（勿直接上传商店）
- `.ico` 未导入（Figma 不支持）— 仍只在 Git

### 官网布局 + Publish 指引（2026-10-31）

- **10 Marketing**：七屏由文案帧升为布局 comps（Ink/Paper、Nav、Capture/Recall mock、Install 双 CTA、Trust 要点）
- **00**：新增 `Library publish` 页——MCP **不能** Publish；人工步骤写在板上
- 实现真相仍是官网代码；Figma = 构图意图

### Extension 中保真 + Marketing Roles（2026-10-31）

- **20 Key screens**：Side Panel / Capture / Library / Getting Started 升中保真，复用 App\* 实例
- **10**：补本地 Product Roles Variables 镜像（Publish 前过渡）

### 收口补丁（同日续）

- **20**：Settings（开关行）+ Detail（含 DetailExportBar 实例）
- **10**：页 `Auth shells` — Login（email OTP）/ Account（profile + plan 说明）
- Pricing 板未开（入口可隐藏；要做再说）

**Agent 可自动完成的 Figma 资源脚手架：已结案。**

### 路径 2 · Publish Brand library（已完成 · 2026-10-31）

- **00 Brand** 已发布为 team library（`libraryName: 00 Brand`）
- **10 / 20 / 30** 均已 **Add to file** 启用
- MCP 抽检：`accent` / `sage*` Variables + `Logo / on-light|on-dark` Components 可从库检索
- 本地 Roles 镜像可留作过渡；新绑定优先用库变量
- 权威仍 `brand.css`：改 hex → 改 00 Variables → Publish update → 消费文件接受更新

### 截图解冻（2026-10-31 · partial）

- Playwright `shot-extension-store.mjs` 加载仓库 `dist/`，截 Side Panel / Library / Settings / Getting Started @1280×800
- 母本：`screenshot-01-sidepanel-recall` · `02-library` · `03-settings`（旧品牌 hero → `archive-*`）
- 契约 + `CHROMEWEBSTORE.md` + 单测已对齐；**30 Store** 帧已替换
- **诚实边界：** 独立空 Profile，非日常库邻域；Capture 划存浮层未截；上架前建议真实库重拍
