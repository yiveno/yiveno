# Yiveno Brand Kit（原始交付 · 归档）

> **⚠️ 发版勿改本目录。** 仓内发版母本为 [`docs/design/brand-assets/`](../docs/design/brand-assets/README.md)；流程见 [`brand-asset-release-checklist.md`](../docs/design/brand-asset-release-checklist.md)。  
> **治理：** [yiveno/yiveno#30](https://github.com/yiveno/yiveno/issues/30)（二进制走 Git LFS，见 [ADR-006](../docs/architecture/decisions/ADR-006-brand-assets-git-lfs.md)）。

这是一套基于现有 Yiveno logo 建立的第一版完整品牌系统。核心方向为 **organic precision / calm intelligence / meaningful connection**，适用于数字产品、官网、社交媒体、包装与基础商务物料。

## 文件结构

| 路径                                          | 内容                                                      |
| --------------------------------------------- | --------------------------------------------------------- |
| `brand-guidelines/Yiveno-Brand-Guidelines.md` | 完整品牌视觉规范                                          |
| `brand-guidelines/design-brief.md`            | 品牌设计简报与延展原则                                    |
| `logo-system/yiveno-primary.svg`              | 原始主标矢量文件                                          |
| `logo-system/yiveno-mark-reference.png`       | 800×800 PNG 参考图                                        |
| `visual-assets/yiveno-core-assets.svg`        | 主标、字标、色板与核心资产展示板                          |
| `applications/yiveno-product-hero.jpg`        | 官网 / 产品主视觉，16:9                                   |
| `applications/yiveno-social-post.jpg`         | 社交媒体方形视觉                                          |
| `applications/yiveno-packaging-card.jpg`      | 包装与产品卡片场景图                                      |
| `chrome-extension/`                           | Chrome 扩展图标、favicon、浅深色 logo 与 Web Store 宣传图 |

## Chrome 扩展资产

Chrome 扩展专用资产已经放在 `chrome-extension/` 目录，包括 `16 / 32 / 48 / 128 / 256 / 512 px` 多种尺寸。详细使用方式请查看 `chrome-extension/README.md`。

**运行时实际加载路径**在 `frontend/public/images/` 与 `website/public/`——由 `docs/design/brand-assets/` 经 `bun run sync:brand-assets` 同步，不要从本目录直链进构建。

## 使用建议

正式发布时，Logo 应优先使用 `yiveno-primary.svg`，PNG 仅用于不支持 SVG 的场景。背景色建议优先使用 Warm Porcelain `#F4F5F0` 或 Forest Ink `#192420`。

规范正文以 [`docs/design/Yiveno-设计标准-v1.md`](../docs/design/Yiveno-设计标准-v1.md) 与 [`packages/design-tokens`](../packages/design-tokens/) 为准；本目录为历史交付快照。

## 品牌语句

推荐主标语：`Grow with intention.`

**产品面（扩展 + 官网）仅美式英语**；中文辅助语句仅供品牌包内部参考，不得直接用作产品 UI 或商店主文案（见产品文档 §0）。

## 交付边界

本版本保持现有图形标志的几何结构不变。由图像生成的应用场景图属于概念展示资产；印刷生产前应在设计软件中以矢量 logo 重新排版。
