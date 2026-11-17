---
created: 2026-11-17T20:57:40+08:00
updated: 2026-11-17T20:57:40+08:00
author: agent:cursor
scope: docs/architecture/decisions
status: 已接受
upstream: docs/product/Yiveno-产品文档-v4.0.md（§7 · 诚实归因军规）
downstream: clue-llm-failure-kind；Side Panel miss / deeper-reading tip；background-error 映射；docs/audits/2026-11-17-honest-attribution-audit.md
---

# ADR-026: 用户可见失败/空态/降级诚实归因

- **状态：** 已接受
- **日期：** 2026-11-17
- **决策者：** 维护者（Task Brief：诚实归因）
- **前置：** §7.0 空结果原则；既有 `background-error.ts` / `memory-error.ts` errorCode → i18n 通道；ADR-021 在线默认

## 背景

触发案例：用户在 Side Panel 输入 `youtube`，书签栏已有 YouTube 书签，但面板只显示「没有足够接近的结果。试试另一个你记得住的细节。」——**真实原因是书签从未导入**（导入默认关；Recall 只查 IndexedDB），文案未告知。同类问题还有 `rules_fallback` 只说「改用本机通道」却不说配额/超时/断网。

## 决定

1. **原因分类机制：** 线索 LLM 失败用闭集 `ClueLlmFailureKind`（quota_monthly / quota_daily / timeout / network / auth / provider_error / not_configured / empty_response / unknown）；分类只看 HTTP 状态、Worker `error` 字段、异常 `name`，禁止文案嗅探。托管客户端抛 `HostedCompleteError` 带 kind（及配额快照）。
2. **沿既有两条通道透传：**
   - Recall 结果字段：`understandErrorKind` / `understandQuota` 与 `understandSource` 同链到 Side Panel；
   - errorCode → i18n：`background-error.ts` / `memory-error.ts`（及书签导入专用 `tChromeBookmarkImportError`）。
3. **`unknown` 是最后手段：** 仅调用点确实无法知道原因时保留泛泛文案，且须记日志；暂缓项清单见审计报告。
4. **静默 fail-open 仍可静默：** 降级后邻域结果仍然好时，不打扰用户；本决策只要求用户看到失败/空态/可能被误读的降级时给真原因。

## 不做

- 不改 Recall 检索 / 打分 / Outcome / 约束邻域 / RRF / 佐证门。
- 不改配额数值与计费；不改导入/同步成功路径。
- 不把 Chrome 书签树直读进 Recall（仍须显式灌库）。

## 触发案例与验收口径

- 库非空、书签计数为 0、`ingest_off` 的 miss：正文追加「书签还没导入」+ Settings 深链。
- `rules_fallback`：deeper-reading tip 按 kind 分流（含配额数字插值；缺快照用不带占位符的同义文案）。
- 整轮 Recall 失败：能判离线则离线文案，否则收紧为「服务暂时出错」。

## 暂缓

调用点暂无法细分的泛泛文案清单与下一步 → `docs/audits/2026-11-17-honest-attribution-audit.md`。
