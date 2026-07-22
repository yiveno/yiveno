# 国际化实施指南（v4 baseline）

> v3 时代的组件级 i18n 约定（`$t()`、批量替换脚本等）已随 baseline 剥离。恢复多语言前，以 **产品文档 v4.0** 为唯一规格来源。

## v4 原则（暂定）

- Manifest `default_locale` 与 `_locales/` 结构保持一致
- UI 文案禁止出现「搜索」；对外使用 **筛选（Filter）** / **找回（Recall）**
- 日期/时间展示须走统一工具（恢复时见 `time-i18n-checklist.md`）

## 不再适用

- `bun run i18n:*` 脚本链
- `i18n-report.json` 扫描报告
- v3 六语言包批量维护流程
