# Yiveno 品牌资产目录

此目录存放项目内长期保留的品牌成品素材，不直接参与运行时打包。

## 目录约定

- `logo/`：主标、参考图、深浅背景 logo 版本
- `chrome-extension/`：扩展图标、favicon、扩展 icon 源
- `chrome-web-store/`：Chrome Web Store 宣传图
- `applications/`：官网主视觉、社媒图、包装场景图

## 与运行时目录的关系

- 扩展运行时使用：`frontend/public/images/`
- 官网运行时使用：`website/public/`
- 本目录作为项目内常驻母本，便于后续替换、导出和运营取用

## 当前映射

- `frontend/public/images/icon16.png` 等图标来自 `chrome-extension/`
- `frontend/public/images/logo-mark.svg` 与 `website/public/images/logo-mark.svg` 来自 `logo/yiveno-primary.svg`
- `website/public/favicon.*` 与 `website/public/apple-touch-icon.png` 来自 `chrome-extension/`
- `website/public/og-image.jpg` 来自 `applications/yiveno-product-hero.jpg`

## 说明

`yiveno-brand-kit/` 仍保留为原始交付目录；本目录是面向仓库长期维护的整理版结构。
