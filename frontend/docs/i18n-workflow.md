# 国际化工作流程（v4 baseline）

> v4 baseline 已移除 v3 的 `i18n:extract` / `i18n:replace` / `i18n:validate` 脚本与多语言包。本文档保留为占位，待 v4 国际化方案在产品文档中定稿后重写。

## 当前状态

- 扩展仅保留 `public/_locales/en/messages.json` 最小 manifest 文案
- UI 文案以 v4 功能恢复时的产品文档为准
- 历史流程与 `i18n-report.json` 已清理

## 恢复 i18n 时须同步

1. 更新 `docs/product/Yiveno-产品文档-v4.0.md` 中的语言与文案约定
2. 在本目录重写实施指南与工作流
3. 在 `frontend/package.json` 注册提取/校验脚本
