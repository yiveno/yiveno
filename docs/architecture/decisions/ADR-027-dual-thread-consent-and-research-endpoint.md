---
created: 2026-11-17T23:55:53+08:00
updated: 2026-11-17T23:55:53+08:00
author: agent:cursor
scope: docs/architecture/decisions
status: 已接受
upstream: docs/product/Yiveno-双线程发展原则.md（§4.1）；docs/product/Yiveno-产品文档-v4.0.md（§0.1.2）
downstream: dualThreadLocalLearningEnabled / dualThreadContributeAggregatesEnabled；Settings privacy；/api/research/sketch；dual_thread_sketches
---

# ADR-027: 暗线同意开关 + 匿名汇总接收端

- **状态：** 已接受
- **日期：** 2026-11-17
- **决策者：** 维护者（Task Brief：暗线同意开关）
- **前置：** ADR-016 双线程；暗线基建脚手架（失败归因 / 适应旋钮登记 / 匿名草图纯函数）

## 背景

本机 Recall 遥测（`yiveno.recallTelemetry`）已在录、只存本机、从不上云。暗线需要：

1. 用户可控的「本机分析并展示学习记录」；
2. 可选「贡献匿名计数汇总」到研究接收端；
3. 诚实文案：暂不自动调整检索行为。

## 决定

1. **两个 Settings flag（默认 OFF，缺省即 false）：**
   - `dualThreadLocalLearningEnabled` — 本地学习（分析 + 展示）；
   - `dualThreadContributeAggregatesEnabled` — 贡献匿名汇总。
2. **不给录制器加门禁：** `recall-telemetry-recorder` / `recall-telemetry-store` 行为不变；开关只控制分析/展示/上传。
3. **不做自动自适应：** 不碰 `recall-adaptation-config` 旋钮值；汇总只用于展示与研究笔记。
4. **贡献门禁：** 须本地学习开 **且** 已登录；每天最多一次成功上传（客户端节流）；失败静默、不挡 Recall。
5. **接收端：** Worker `POST/DELETE /api/research/sketch`（Supabase Bearer，无 Pro 门禁）；存 Supabase 表 `dual_thread_sketches`（非 KV/D1）；body 拒绝 `cluePreview` / `anchor` / schema 外字段。
6. **账号注销：** `deleteAccountForOwner` 显式删除该用户草图行；表上 `user_id → auth.users ON DELETE CASCADE` 为双保险。

## 不做

- 不自动改检索行为 / 旋钮。
- 不上传线索原文、条目标题、链接或摘录锚点。
- 本批迁移只写文件，不推送 hosted Supabase。

## 已知跟进

- Hosted 库需维护者自行 `supabase db push`（或等价）后再做端到端写入验收。
- 失败环节归因仍为手工卡片；生产无归因数据时学习记录显示「暂无归因记录」。
