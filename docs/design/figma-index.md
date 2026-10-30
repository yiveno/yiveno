---
created: 2026-10-31T00:15:43+08:00
updated: 2026-10-31T01:53:37+08:00
author: agent:cursor
scope: Yiveno Figma Design 库索引（MCP 无法枚举 folder，仓内维护 URL）
status: active
upstream:
  - docs/audits/2026-10-UI资产与Figma职责分配.md
  - docs/design/brand-assets/README.md
  - docs/design/Yiveno-设计标准-v1.md
  - packages/design-tokens/css/brand.css
  - extension/src/infrastructure/ui/
downstream:
  - Figma folder 639346673
  - docs/design/brand-assets/_captures/（仅再生脚本；PNG 不入库）
  - bun run sync:brand-assets（导出后）
---

# Figma 设计库索引

> **Folder：** [yiveno · UI / brand](https://www.figma.com/files/folder/639346673)（`projectId`=`639346673`）  
> **职责：** 见 [`../audits/2026-10-UI资产与Figma职责分配.md`](../audits/2026-10-UI资产与Figma职责分配.md)  
> **业务逻辑图：** 不在此库；见 [`../diagrams/`](../diagrams/README.md)（Mermaid 单源）

## 权威链（勿颠倒）

```text
设计标准 + packages/design-tokens/css/brand.css
  → Figma Design（意图 / comps / 构图）
  → docs/design/brand-assets/（发版母本）
  → sync:brand-assets → public / 商店后台
  → 产品 UI 实现 = Vue / Astro（交互真相）
```

## 文件表

| 文件                   | fileKey                  | URL                                                         | 内容                                                                                                       |
| ---------------------- | ------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **00 Brand**           | `1AcC2OyAcjLETPYKpVKoYe` | [打开](https://www.figma.com/design/1AcC2OyAcjLETPYKpVKoYe) | Variables；Assets；Usage；页 **Library publish**（人工 Publish 指引 · MCP 不能发库）                       |
| **10 Marketing**       | `GnC15EbugKqB8uJxprPwDC` | [打开](https://www.figma.com/design/GnC15EbugKqB8uJxprPwDC) | §6.1 七屏布局；页 **Auth shells**（Login / Account）；Roles 镜像                                           |
| **20 Extension comps** | `nlYZA0xo20vHcUNmITbMHI` | [打开](https://www.figma.com/design/nlYZA0xo20vHcUNmITbMHI) | Key screens 中保真：Side Panel / Capture / Library / GS / **Settings** / **Detail+export**；App\* + Roles  |
| **30 Store listing**   | `iPlCypzn5NJrYmtKpByxWh` | [打开](https://www.figma.com/design/iPlCypzn5NJrYmtKpByxWh) | CWS 框；promo；**产品 UI 截图** Side Panel / Library / Settings（+ GS 占 Capture 槽）；Design sources 大图 |
| **90 Archive**         | `IoHg86NsZmcpacjXJTlj89` | [打开](https://www.figma.com/design/IoHg86NsZmcpacjXJTlj89) | 废弃探索                                                                                                   |

## 组件 ↔ 代码对照（20 Extension · App\*）

| Figma Component      | 代码                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `AppButton`          | `extension/src/infrastructure/ui/AppButton.vue`                    |
| `AppSwitch`          | `…/AppSwitch.vue`                                                  |
| `AppIconButton`      | `…/AppIconButton.vue`（字形占位；真 path → `icons/icon-paths.ts`） |
| `AppToast`           | `…/AppToast.vue`                                                   |
| `AppModal / size=sm` | `…/AppModal.vue`                                                   |
| `AppConfirmModal`    | `…/AppConfirmModal.vue`                                            |
| `AppSectionTabs`     | `…/AppSectionTabs.vue`                                             |
| `AppLibraryItemCard` | `…/AppLibraryItemCard.vue`                                         |
| `AppTextarea`        | `…/AppTextarea.vue`                                                |
| `AppLinearProgress`  | `…/AppLinearProgress.vue`                                          |
| `AppPageHeader`      | `…/AppPageHeader.vue`                                              |
| `AppHoverTip`        | `…/AppHoverTip.vue`                                                |
| `AppMenuButton`      | `…/AppMenuButton.vue`                                              |
| `DetailExportBar`    | `…/DetailExportBar.vue`                                            |

未移植（仍以代码为准）：`AppToastHost`（宿主壳）、`DetailExportBarDock`、`AppLibraryItemFavicon`、全量 `AppIcon` 闭集。

## Brand Assets 页对照（00）

| Figma 区                                                | 仓内路径                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Logo / primary · on-light/dark SVG+PNG · mark reference | `brand-assets/logo/`                                                                  |
| Icon / extension mark + size ladder 16–512              | `brand-assets/chrome-extension/`                                                      |
| Applications · product hero / social / packaging        | `brand-assets/applications/`                                                          |
| Favicon SVG/PNG · apple-touch · OG                      | `website/public/`（发版仍经 sync/checklist；`.ico` 仅 Git）                           |
| Color palette PNG                                       | `docs/design/brand/color-palette.png`                                                 |
| CWS design sources（非上传大图）                        | `brand-assets/chrome-web-store/*-promo.png` · `*-marquee.png` → **30 Design sources** |
| CWS 产品 UI 截图 01–03                                  | `chrome-web-store/screenshot-0{1,2,3}-*.png` → **30** 对应帧                          |

## 本地派生截图

| 路径                                              | 用途                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `brand-assets/_captures/shot-sections.mjs`        | 官网分节截图（按需；产出后删 PNG）                                      |
| `brand-assets/_captures/shot-extension-store.mjs` | 扩展 `dist` → `/tmp` 出图；Profile 退出即删；定稿拷 `chrome-web-store/` |

## 已知阻塞 / 暂缓

1. **截图解冻已做一版**：Playwright 空库产品壳 → CWS 01–03 + Figma 30；**Capture 划存浮层**仍缺；日常真实库邻域重截建议上架前补。
2. **MCP `chrome-extension://`** 仍失败 → 扩展截图走 Playwright `load-extension`。
3. **00 Brand team library 已发布**；**10 / 20 / 30 已启用**。改色仍先 `brand.css` → 回灌 00 → Publish update。

## Agent / 人工约定

1. 改色：先改 `brand.css` + 设计标准，再回灌 **00 Brand** Variables，并同步 **20** 本地 Roles 镜像。
2. 定稿导出：命名对齐 [`brand-asset-release-checklist.md`](./brand-asset-release-checklist.md)。
3. 新文件若建在本 folder，**同批更新本表**。
4. 探测板 `MCP access probe`（`A6fqmlxlR0DT58LCETnizA`）可在 Figma folder 内手动删（MCP 已无写权限 / 可能已删）。
