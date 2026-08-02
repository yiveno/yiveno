# Yiveno — Gemini CLI 项目上下文

Chrome 扩展：**个人信息寻回**（Capture 低负担 + Recall 高置信）。不是书签管理器 / 笔记工具 / 聊天机器人。

## 审查时优先关注

- 单向数据流：Chrome API → Background → IndexedDB → UI；UI 经 `background-client`，禁止直连 IndexedDB / `chrome.bookmarks|tabs`。
- 新 message `type` 必须先改 `frontend/src/core/messaging/*`。
- UI 文案：禁止「搜索」/ `Search`；用 **筛选（Filter）** / **找回（Recall）**；文案经 `t()` + `_locales`。
- LLM 不直接查插改删数据平面；事实源是 IndexedDB MemoryItem。
- Free：关键词 Filter；勿暗示未上线 Hybrid/embedding 可用。

## 仓库结构

- `frontend/` — Vue 扩展（pages / application / core / infrastructure / background）
- `backend/` — Cloudflare Worker
- `website/` — 营销站
- 权威产品文档：`docs/product/Yiveno-产品文档-v4.0.md`

## 协作约定

- 注释 / commit message 用中文；质量门禁以 `ci.yml` 为准，本助手不替代 typecheck/lint/test。
