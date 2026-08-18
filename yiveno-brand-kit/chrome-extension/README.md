# Yiveno Chrome Extension Brand Assets

## Extension icon package

`yiveno-extension-icon.svg` 是扩展图标的矢量源文件，适合继续编辑与导出。PNG 已提供 `16 / 32 / 48 / 128 / 256 / 512 px` 多种尺寸，覆盖浏览器工具栏、扩展管理页、桌面快捷方式、商店展示与高分辨率设备场景。

| 文件           | 推荐场景                              |
| -------------- | ------------------------------------- |
| `icon-16.png`  | 浏览器工具栏或极小尺寸 UI             |
| `icon-32.png`  | Windows / Linux 快捷方式及中等尺寸 UI |
| `icon-48.png`  | 扩展管理页与设置入口                  |
| `icon-128.png` | Chrome Web Store 扩展图标与安装展示   |
| `icon-256.png` | 高分辨率产品页面与导出中间尺寸        |
| `icon-512.png` | 宣传页、设计源文件与高分辨率备份      |
| `favicon.ico`  | 官网、扩展设置页及浏览器标签页        |

## Light / dark theme logo

`yiveno-logo-on-light.svg/png` 适用于 Warm Porcelain、白色和浅色界面；`yiveno-logo-on-dark.svg/png` 适用于 Forest Ink、Deep Moss 与深色主题。浅色主题沿用原始深绿渐变，深色主题使用 Warm Porcelain 与 Soft Dew 的浅色组合，保证 logo 在明暗背景中保持稳定识别度。

## Chrome Web Store visuals

本次新增了一套专门面向 Chrome Web Store 的 Promotional Banners 与商店展示图。`promotional-banner-marquee-1400x560.png` 是宽幅主横幅，适合商店顶部品牌展示；`promotional-banner-small-440x280.png` 是小型推广卡片；`store-screenshot-focus-1280x800.png` 与 `store-screenshot-connect-1280x800.png` 是两张统一风格的功能卖点展示图，分别表达 Focus 与 Connect。

同时保留了 `store-promo-marquee-concept.png`、`store-promo-tile-concept.png`、`store-feature-focus.png` 和 `store-feature-connect.png` 四张高分辨率概念源图，方便后续继续裁切、改版或在设计软件中重新排版。正式上线前建议根据 Chrome Web Store 当前上传界面重新确认平台对像素尺寸、文件大小和截图数量的要求。

## Promotional messaging

当前宣传体系围绕三组信息展开：主张使用 `Grow with intention`；功能卖点使用 `Focus` 与 `Connect`；视觉关键词使用 calm、intentional、connected。建议商店标题和描述保持产品功能优先，宣传图只承担品牌识别与单一卖点表达，避免在一张图中堆叠多个功能。

## Manifest usage example

```json
{
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

建议将 `chrome-extension/icon-16.png`、`icon-32.png`、`icon-48.png` 和 `icon-128.png` 复制到扩展项目的 `icons/` 目录，并在 `manifest.json` 中按上方方式引用。对于网站 favicon，可直接使用 `favicon.ico`，或者引用 `yiveno-extension-icon.svg` 作为现代浏览器的 SVG favicon。
