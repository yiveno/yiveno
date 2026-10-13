# Yiveno 品牌资产目录（仓内母本）

此目录是 **GitHub Org `yiveno/yiveno` 主仓内** 长期维护的品牌成品母本，不直接参与 Vite/Astro 打包；发版前同步到运行时 `public/`。

**发版流程：** [`brand-asset-release-checklist.md`](../brand-asset-release-checklist.md)  
**自动同步：** `bun run sync:brand-assets`（根目录）  
**存储：** 本目录二进制走 **Git LFS**（[ADR-006](../../architecture/decisions/ADR-006-brand-assets-git-lfs.md)）；clone 后 `bun run setup:git-lfs`  
**治理：** [Issue #30](https://github.com/yiveno/yiveno/issues/30)

## 目录约定

| 子目录              | 内容                                              |
| ------------------- | ------------------------------------------------- |
| `logo/`             | 主标、参考图、深浅背景 logo 版本                  |
| `chrome-extension/` | 扩展图标、favicon、扩展 icon 矢量源               |
| `chrome-web-store/` | Chrome Web Store 宣传图（仅上传后台，不进扩展包） |
| `applications/`     | 官网主视觉、社媒图、包装场景图                    |

## 与运行时目录的关系

| 运行时 | 路径                                        |
| ------ | ------------------------------------------- |
| 扩展   | `extension/public/images/`                  |
| 官网   | `website/public/`、`website/public/images/` |

完整文件级映射见 Checklist §3；默认用 `bun run sync:brand-assets` 执行 §2 映射。

## 规范引用

- 视觉 Normative：[`Yiveno-设计标准-v1.md`](../Yiveno-设计标准-v1.md)
- 导出尺寸与 prompt：[`Yiveno-logo-asset-generation-prompt.md`](../Yiveno-logo-asset-generation-prompt.md)
