# Chrome Web Store 图形母本

> **用途：** 仅上传 [Chrome Web Store 开发者后台](https://chrome.google.com/webstore/devconsole)，**不进**扩展 `dist/` 包。  
> **契约：** `extension/src/core/extension/extension-cws-graphics-contract.ts` + `chromewebstore-graphics-contract.test.ts`  
> **上架清单：** 仓库根 [`CHROMEWEBSTORE.md`](../../../../CHROMEWEBSTORE.md)

## 可上传文件

| 商店槽位             | 母本文件                                      | 尺寸     | 说明                                                 |
| -------------------- | --------------------------------------------- | -------- | ---------------------------------------------------- |
| Screenshot 1（必填） | `screenshot-01-sidepanel-recall-1280x800.png` | 1280×800 | 产品 UI · Side Panel 冷启动空态（Playwright `dist`） |
| Screenshot 2（推荐） | `screenshot-02-library-1280x800.png`          | 1280×800 | 产品 UI · Library 空摘录态                           |
| Screenshot 3（推荐） | `screenshot-03-settings-1280x800.png`         | 1280×800 | 产品 UI · Settings                                   |
| Small promo（推荐）  | `chrome-web-store-small-promo-440x280.png`    | 440×280  | 已合规                                               |
| Marquee promo        | `chrome-web-store-marquee-1400x560.png`       | 1400×560 | 已合规                                               |

## 待补（更高保真）

1. **Recall** — 日常真实库 · 非空邻域（clue + ≥2 卡）
2. **Capture** — 划词工具条 / 上下文菜单保存
3. **Library** — 有条目的列表/书签树

**再生（空 Profile 产品壳）：**

```bash
cd extension && bun run build
bun docs/design/brand-assets/_captures/shot-extension-store.mjs
# 产出在 _captures/；定稿后拷入本目录并更新契约 + CHROMEWEBSTORE.md
```

## 非上传文件

- `chrome-web-store-small-promo.png` / `chrome-web-store-marquee.png` — 设计溯源大图（尺寸不合规）
- `archive-screenshot-01-brand-focus-1280x800.png` / `archive-screenshot-02-brand-connect-1280x800.png` — 旧品牌 hero 临时图

## 溯源

- 2026-10-31：Screenshot 1–3 由 Playwright 加载仓库 `dist/` 截取（独立 Profile · 空库）。
- Figma：**30 Store listing** 已叠对应帧。
