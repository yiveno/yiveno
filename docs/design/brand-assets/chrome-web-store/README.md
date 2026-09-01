# Chrome Web Store 图形母本

> **用途：** 仅上传 [Chrome Web Store 开发者后台](https://chrome.google.com/webstore/devconsole)，**不进**扩展 `dist/` 包。  
> **契约：** `frontend/src/core/extension/extension-cws-graphics-contract.ts` + `chromewebstore-graphics-contract.test.ts`  
> **上架清单：** 仓库根 [`CHROMEWEBSTORE.md`](../../../../CHROMEWEBSTORE.md)

## 可上传文件

| 商店槽位             | 母本文件                                   | 尺寸     | 说明                                                                        |
| -------------------- | ------------------------------------------ | -------- | --------------------------------------------------------------------------- |
| Screenshot 1（必填） | `screenshot-01-brand-focus-1280x800.png`   | 1280×800 | 品牌 hero（**临时**）；公开发布前建议换为 Recall Side Panel **真实产品 UI** |
| Screenshot 2（推荐） | `screenshot-02-brand-connect-1280x800.png` | 1280×800 | 品牌 hero（**临时**）；建议换为 Capture / Library 产品 UI                   |
| Small promo（推荐）  | `chrome-web-store-small-promo-440x280.png` | 440×280  | 已合规                                                                      |
| Marquee promo        | `chrome-web-store-marquee-1400x560.png`    | 1400×560 | 已合规                                                                      |

## 待补（产品 UI）

对照 `CHROMEWEBSTORE.md` → Screenshot Notes，以下场景**尚无** 1280×800 母本：

1. **Recall（Side Panel）** — clue 输入 + 邻域结果列表
2. **Capture** — 划词工具条 / 上下文菜单保存
3. **Library** — 可浏览列表或书签树
4. **Omnibox**（可选）— `yi` 快捷跳转
5. **Settings**（可选）— 隐私 / 同步开关

**抓取建议：** `cd frontend && bun run build` → `chrome://extensions` 重新加载 → 打开 `sidepanel.html` / `library.html` / `settings.html` → 视口 1280×800 截图 → 以 `screenshot-0N-{scene}-1280x800.png` 命名落盘本目录 → 同批更新 `extension-cws-graphics-contract.ts` 与 `CHROMEWEBSTORE.md`。

## 非上传文件（设计稿导出）

以下大图仅作设计溯源，**勿**上传商店（尺寸不合规）：

- `chrome-web-store-small-promo.png`（2304×1536）
- `chrome-web-store-marquee.png`（2080×1664）

## 溯源

`screenshot-01` / `screenshot-02` 自 `yiveno-brand-kit/chrome-extension/store-screenshot-*-1280x800.png` 整理导入（2026-09-01）。
