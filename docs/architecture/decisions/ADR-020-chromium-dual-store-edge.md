# ADR-020: Chromium 双店同包（Chrome + Edge）· 大陆主路径 Edge

- **状态：** 已接受
- **日期：** 2026-10-28
- **决策者：** 产品 / 工程

## 背景

大陆桌面用户常无法稳定访问 Chrome Web Store，手动侧载不适合作主获客路径。Yiveno 为 MV3 Chromium 扩展，所用 `chrome.*` API（Side Panel、书签、Omnibox、favicon 等）与 Microsoft Edge Chromium **代码兼容**。需要钉死分发模型，避免「为 Edge 重写一套」或「只靠 ZIP 手动装」的分叉。

## 决定

### 1. 同一代码仓、同一 `dist` ZIP

- 一份 MV3 包同时提交 **Chrome Web Store** 与 **Microsoft Edge Add-ons**。
- **禁止**维护第二套业务实现或 Edge 专用业务 fork；允许浏览器壳差异（如快捷键设置页 `chrome://` vs `edge://`）。

### 2. 扩展 ID 分离 · 本机库不跨浏览器合并

- 两店各自分配 extension id；安装目录互不同步。
- 账号 / 摘录云同步仍走现有 Auth（ADR-018）；**书签 Memory 仍各浏览器本机灌库**（ADR-017）——Edge 收藏夹 ≠ Chrome 书签林，**禁止**用云并集跨浏览器拼书签。

### 3. 大陆桌面安装主路径 = Edge Add-ons

- Edge 上架后：`.cn` / 大陆 geo 官网主 CTA → **Install for Microsoft Edge**（商店深链）。
- 能访问 CWS 的用户仍可走 Chrome（并行，非互斥）。
- 消费级「下载 ZIP + 开发者模式」**不得**当大陆主 CTA；仅作商店未就绪时的诚实备用。

### 4. 用户可见叙事

- 对外称 **浏览器扩展 / Chromium（Chrome 与 Edge）**；禁止暗示「只能装 Chrome」或用全平台份额话术夸大 Edge。
- Getting Started / Settings 书签文案用「本浏览器书签 / browser bookmarks」，避免硬绑 Chrome 品牌（开发者注释可保留 Chrome）。

### 5. 官网桥

- `externally_connectable` 须覆盖生产官网 **`yiveno.com` 与 `yiveno.cn`**（及 www），以便大陆 Edge 用户在 `.cn` 完成登录 handoff。

## 后果

- 根目录维护 [`EDGEADDONS.md`](../../../EDGEADDONS.md)（对标 `CHROMEWEBSTORE.md`）；物料可与 CWS 图共用并注明双店。
- 产品文档 §1 / 隐私披露按店分述上架状态；未上架店不得假装可装。
- 发版：同 semver；双店 changelog 要点对齐；Partner Center 须 **MSA** 注册 Edge 开发者计划。
- Edge 真机验收清单（Capture / Recall / 书签 / Omnibox / 官网桥 / 快捷键页）为「Edge 就绪」门槛；禁止只靠 Chrome MCP 冒充。

## 拒绝的替代

| 方案                    | 原因                                         |
| ----------------------- | -------------------------------------------- |
| 为 Edge 重写 / 第二仓   | Chromium 同 API；成本虚高、双倍漂移          |
| 仅侧载 ZIP 作大陆主路径 | Chrome/Edge 消费侧载受限、无自动更新、信任差 |
| 云并多浏览器书签林      | 与 ADR-017 冲突；跨浏览器书签语义混乱        |
| 本波次上 360 等国产店   | 审核与兼容面另开；待大陆量再议               |

## 上游

- ADR-001（Side Panel 主壳）· ADR-017（书签本机）· ADR-018（身份）· ADR-019（UI 桥）

## 下游

- `EDGEADDONS.md` · `externally-connectable-origins.ts` · 快捷键 URL 适配 · 官网安装 CTA · `CURRENT.md` / 产品文档 Normative
